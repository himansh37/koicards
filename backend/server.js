// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Render (and most hosts) sit behind a reverse proxy, so without this every
// request looks like it comes from the proxy's IP and the per-IP limiter
// below would end up rate-limiting everyone as a single visitor.
app.set('trust proxy', 1);

// Middleware
app.use(cors());
// IMPORTANT: Increase the data limit so we can accept large image files
app.use(express.json({ limit: '10mb' }));

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

// The Route
// perIpLimiter runs first so a visitor who's already used up their own 5
// doesn't also eat into the shared 150/day global budget.
app.post('/api/generate', perIpLimiter, globalLimiter, async (req, res) => {
    try {
        // 1. Get the payload (image data & prompt) from the frontend
        const payload = req.body;

        // 2. Get the API Key from the secure .env file
        const apiKey = process.env.API_KEY;
        
        // 3. Define the Gemini API URL
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        // 4. Send the request to Google (Server-to-Server)
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        // 5. Send Google's response back to the frontend
        res.json(response.data);

    } catch (error) {
        console.error("Error connecting to Gemini:", error.message);
        // Send a meaningful error back to frontend
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});