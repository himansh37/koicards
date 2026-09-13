// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Don't advertise the framework in every response.
app.disable('x-powered-by');

// Render (and most hosts) sit behind a reverse proxy, so without this every
// request looks like it comes from the proxy's IP and the per-IP limiter
// below would end up rate-limiting everyone as a single visitor.
app.set('trust proxy', 1);

// --- CORS ---------------------------------------------------------------
// Only our own frontend (plus local dev servers) may call this from a browser.
// Extra origins can be added via ALLOWED_ORIGINS="https://a.com,https://b.com".
// NOTE: CORS only restrains browsers on other sites; curl/scripts ignore it.
// The request validation further down is what actually stops this endpoint
// being used as a general-purpose Gemini proxy.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://himansh37.github.io')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
const LOCAL_DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

app.use(cors({
    origin(origin, callback) {
        // No Origin header = not a cross-origin browser request (curl, server-to-server).
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin) || LOCAL_DEV_ORIGIN.test(origin)) {
            return callback(null, true);
        }
        return callback(null, false); // the browser will refuse to expose the response
    },
    methods: ['POST'],
}));

// A 5 MB image is ~6.8 MB as base64, plus a little JSON around it.
app.use(express.json({ limit: '8mb' }));

// --- Rate limiting -------------------------------------------------------
const RATE_LIMIT_MESSAGE = { error: "You've used today's free limit. Please try again tomorrow." };

// Per-visitor cap: 5 flashcard-generation requests per IP per day.
const perIpLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE
});

// Global safety net: caps total daily calls across every visitor combined,
// so a sudden traffic spike can't blow through the free Gemini quota.
const globalLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 150,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: () => 'global', // one shared counter for all requests
    message: RATE_LIMIT_MESSAGE
});

// --- Gemini request construction -----------------------------------------
// The server builds the entire Gemini request itself. The only things a
// client can influence are the image bytes and which mnemonic style to use,
// so the endpoint can never be repurposed for arbitrary prompts.
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const GEMINI_TIMEOUT_MS = 60 * 1000;

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil(MAX_IMAGE_BYTES / 3) * 4;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

const MNEMONIC_STYLES = {
    hinglish: "Hinglish (Hindi + English mix) — example: 'Kono sounds like KONO — yaad karo!'",
    english: "English only — write the entire mnemonic in English only, no other language",
    chinese: "Mandarin Chinese only — write the entire mnemonic completely in Mandarin Chinese (简体中文), no English",
    korean: "Korean only — write the entire mnemonic completely in Korean (한국어), no English",
    indonesian: "Bahasa Indonesia only — write the entire mnemonic completely in Bahasa Indonesia, no English",
    portuguese: "Brazilian Portuguese only — write the entire mnemonic completely in Portuguese, no English",
    german: "German only — write the entire mnemonic completely in German, no English",
    spanish: "Mexican Spanish only — write the entire mnemonic completely in Spanish, no English",
    taiwanese: "Traditional Chinese only — write the entire mnemonic completely in Traditional Chinese (繁體中文), no English",
    vietnamese: "Vietnamese only — write the entire mnemonic completely in Vietnamese, no English"
};
const DEFAULT_STYLE = 'english';

const RESPONSE_SCHEMA = {
    type: 'ARRAY',
    items: {
        type: 'OBJECT',
        properties: {
            japanese: { type: 'STRING' },
            reading: { type: 'STRING' },
            english: { type: 'STRING' },
            mnemonic: { type: 'STRING' }
        },
        required: ['japanese', 'reading', 'english', 'mnemonic']
    }
};

function buildPrompt(styleKey) {
    const selectedStyle = MNEMONIC_STYLES[styleKey] || MNEMONIC_STYLES[DEFAULT_STYLE];
    return `Act as an expert Japanese OCR, translator, and a creative memory coach. Analyze the text in the image. For each word or phrase, provide: 1. The original Japanese writing (including Kanji). 2. Its reading in Hiragana (furigana). 3. Its English translation. 4. A short memorable mnemonic to help remember this word. Write it COMPLETELY in ${selectedStyle}. Do not mix languages unless the style specifically says to mix. Return the result as a JSON array of objects. Each object must have "japanese", "reading", "english", and "mnemonic" properties.`;
}

// Runs BEFORE the rate limiters so a malformed request doesn't cost anyone a
// quota point — only requests that will actually reach Gemini get counted.
function validateGenerateRequest(req, res, next) {
    const body = req.body;
    if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: 'Invalid request body.' });
    }
    const { image, mimeType } = body;
    if (typeof mimeType !== 'string' || !ALLOWED_MIME_TYPES.has(mimeType)) {
        return res.status(400).json({ error: 'Unsupported image type. Please use a PNG, JPEG, WebP or HEIC image.' });
    }
    if (typeof image !== 'string' || image.length === 0) {
        return res.status(400).json({ error: 'No image data was provided.' });
    }
    if (image.length > MAX_BASE64_LENGTH) {
        return res.status(400).json({ error: 'Image is too large (maximum 5 MB).' });
    }
    if (!BASE64_RE.test(image)) {
        return res.status(400).json({ error: 'Image data is not valid base64.' });
    }
    next();
}

function normalizeCards(cards) {
    if (!Array.isArray(cards)) return null;
    const str = (v) => (typeof v === 'string' ? v.trim() : '');
    return cards
        .filter((c) => c && typeof c === 'object' && str(c.japanese))
        .map((c) => ({
            japanese: str(c.japanese),
            reading: str(c.reading),
            english: str(c.english),
            mnemonic: str(c.mnemonic)
        }));
}

// --- Routes ----------------------------------------------------------------
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// perIpLimiter runs before globalLimiter so a visitor who's already used up
// their own 5 doesn't also eat into the shared 150/day global budget.
app.post('/api/generate', validateGenerateRequest, perIpLimiter, globalLimiter, async (req, res) => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.error('API_KEY is not set in the environment.');
        return res.status(500).json({ error: 'Server is not configured.' });
    }

    const { image, mimeType } = req.body;
    // Unknown styles fall back to the default rather than failing the request.
    const styleKey = MNEMONIC_STYLES[req.body.mnemonicStyle] ? req.body.mnemonicStyle : DEFAULT_STYLE;

    const geminiPayload = {
        contents: [{
            role: 'user',
            parts: [
                { text: buildPrompt(styleKey) },
                { inlineData: { mimeType, data: image } }
            ]
        }],
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA
        }
    };

    try {
        const response = await axios.post(GEMINI_URL, geminiPayload, {
            headers: {
                'Content-Type': 'application/json',
                // Header rather than ?key= in the URL, so the key stays out of
                // proxy/CDN/hosting access logs.
                'x-goog-api-key': apiKey
            },
            timeout: GEMINI_TIMEOUT_MS
        });

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        let parsed = null;
        try { parsed = JSON.parse(text); } catch (_) { /* handled below */ }

        const cards = normalizeCards(parsed);
        if (!cards) {
            console.error('Gemini returned an unexpected response shape.');
            return res.status(502).json({ error: 'The AI returned an unexpected response. Please try again.' });
        }

        // Only the cards go back to the client — never the raw upstream response.
        res.json({ cards });
    } catch (error) {
        // Full details stay in the server logs; the client gets a generic message.
        const status = error.response?.status;
        const detail = error.response?.data ? JSON.stringify(error.response.data).slice(0, 500) : '';
        console.error('Gemini request failed:', status || error.code || error.message, detail);

        if (status === 429) {
            return res.status(503).json({ error: 'The AI service is busy right now. Please try again in a moment.' });
        }
        return res.status(502).json({ error: 'Flashcard generation failed. Please try again.' });
    }
});

// JSON error responses for body-parser failures instead of Express's HTML pages.
app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Image is too large (maximum 5 MB).' });
    }
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
