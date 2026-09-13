# KoiCards — Security Review

**Date:** 2026-09-13
**Scope:** Everything in this repo as deployed — `backend/server.js` (Render), `frontend/` (GitHub Pages), the service worker, third-party dependencies, the public git repository itself, and the live HTTP behavior of both deployments.
**Method:** Full manual source review of every file, plus live probes against the deployed backend and frontend (response headers, CORS preflight from a hostile origin, HTTP→HTTPS behavior), plus a secrets scan of the working tree *and the entire git history*.

**What this review did NOT do (be honest about the gaps):**
- No browser-driven dynamic testing — headless browser tooling was unavailable during this session, so the XSS finding below is proven statically (the vulnerable code path is unambiguous), not by executing a payload.
- No dependency vulnerability scan — `npm` is not available on this machine, so `npm audit` was not run. Do this yourself (see Finding 8).
- The rate-limit bypass check was reasoned from configuration, not live-tested, because live-testing it burns your own daily Gemini quota (which happened once already earlier).

---

## Remediation status (applied after the review, same day)

| # | Finding | Status |
|---|---|---|
| 1 | Open Gemini proxy | **Fixed** — server now builds the entire Gemini request itself and only accepts `{ image, mimeType, mnemonicStyle }`; image type allowlisted, size capped at 5 MB, base64 validated; CORS restricted to the GitHub Pages origin + localhost. Validation runs *before* the rate limiters so junk requests no longer cost quota. |
| 2 | Stored XSS via deck name | **Fixed** — deck name now set with `textContent`. |
| 3 | Unpinned / no-SRI CDN scripts | **Fixed (with one deliberate exception)** — Chart.js pinned to 4.5.1 + SRI, GSAP 3.12.2 + SRI, hashes computed from the live CDN bytes. Tailwind pinned to 3.4.17 but **without** SRI: its CDN sends no CORS header, and SRI without CORS makes the browser refuse the script entirely. |
| 4 | No CSP | **Not done** — blocked on moving off the Tailwind Play CDN (needs a build step, and can't be verified without a browser here). |
| 5 | `x-powered-by` | **Fixed** — `app.disable('x-powered-by')`. |
| 6 | Raw upstream errors relayed | **Fixed** — full detail logged server-side; client gets generic messages; response now contains only `{ cards }`, never the raw Gemini payload. |
| 7 | API key in URL | **Fixed** — sent as `x-goog-api-key` header. |
| 8 | No lockfile / no audit | **Not done** — requires `npm`, unavailable on this machine. Run `npm install && npm audit` in `backend/` and commit `package-lock.json`. |
| 9 | In-memory rate limits | Unchanged (known, planned in `API_QUOTA_PLAN.md`). |
| 10 | No input limits / reserved names | **Fixed** — `maxlength` on deck name (60) and card-edit fields (200/500); `__proto__`/`constructor`/`prototype` rejected as deck names. |
| 11 | Framable | **Not done** — would come with the CSP (`frame-ancestors`) in #4. |

**Side effects to know about:**
- The frontend and backend request format changed together. Both deploy from the same push (GitHub Pages + Render), but Render usually lags Pages by a minute or two — during that window a generation attempt will fail with a friendly error, then work.
- Opening `index.html` directly from disk (`file://`) can no longer call the API: a `file://` page sends `Origin: null`, which is (correctly) not on the allowlist. For local testing, serve the folder over `http://localhost` / `127.0.0.1` (e.g. VS Code "Live Server"), which is allowed.
- A new `GET /health` endpoint returns `{"status":"ok"}` — visiting the backend root no longer needs to look like an error.

---

## Summary

| # | Finding | Severity | Where |
|---|---|---|---|
| 1 | Backend is an open, unauthenticated proxy to your Gemini key | **High** | `backend/server.js` |
| 2 | Stored XSS via deck names in the progress dashboard | **Medium** | `frontend/app.js:448` |
| 3 | Third-party scripts loaded with no integrity checks; one is unpinned | **Medium** | `frontend/index.html:26-27, 286` |
| 4 | No Content-Security-Policy on the frontend | **Medium** | `frontend/index.html` |
| 5 | Server technology disclosed (`x-powered-by: Express`) | Low | `backend/server.js` |
| 6 | Raw upstream (Google) error bodies forwarded to clients | Low | `backend/server.js:69` |
| 7 | API key sent as a URL query parameter | Low | `backend/server.js:55` |
| 8 | No lockfile committed; no dependency audit possible here | Low | `backend/` |
| 9 | Rate limits are in-memory and reset on restart | Low (known) | `backend/server.js` |
| 10 | No input length limits; reserved-name deck names silently fail | Low | `frontend/app.js` |
| 11 | Frontend can be framed (no clickjacking protection) | Low | GitHub Pages |

Overall: **nothing catastrophic** — no leaked secrets, no auth to break, HTTPS everywhere. But Finding 1 is genuinely important before you promote this widely, and Finding 2 is a real bug that becomes serious the moment deck sharing/import ships (it's on your roadmap).

---

## Findings

### 1. Backend is an open, unauthenticated proxy to your Gemini key — **High**

**What:** `POST /api/generate` accepts *any* JSON body from *any* origin and forwards it verbatim to Gemini with your API key attached. There is no check that the request is actually a flashcard-generation request.

**Live evidence (this session):**
```
OPTIONS /api/generate  Origin: https://evil.example
→ 204 No Content
  access-control-allow-origin: *
  access-control-allow-methods: GET,HEAD,PUT,PATCH,POST,DELETE
```
`app.use(cors())` with no options allows every origin. And since the endpoint URL is hardcoded in your public `app.js`, it's trivially discoverable.

**Impact:** Anyone can use your backend as a free, general-purpose Gemini API — arbitrary prompts, not just images — up to the rate limits (5/IP/day, 150/day global). The rate limiting you added is what keeps this from being *Critical*; it caps the damage at 150 calls/day, but every one of those can be someone else's workload on your key. A large `10mb` JSON body limit also lets each call be expensive.

**Important nuance:** restricting CORS is necessary but **not sufficient**. CORS only stops *browsers* on other sites — `curl`, scripts, and bots ignore it completely. The real fix is to stop forwarding arbitrary payloads.

**Fix (in order of impact):**
1. **Build the Gemini request server-side.** Accept only `{ image, mimeType, mnemonicStyle }` from the client. Construct the prompt, `responseSchema`, and `generationConfig` on the server. This alone eliminates the "free general-purpose AI proxy" problem — the server can *only* ever make flashcard requests.
2. Validate the image: allowlist `mimeType` (`image/png`, `image/jpeg`, `image/webp`), cap the base64 length (a real photo is well under 10MB; consider ~5MB), reject anything else with a 400.
3. Validate `mnemonicStyle` against the same allowlist the frontend uses; fall back to a default rather than trusting the string.
4. Restrict CORS to your actual origins: `cors({ origin: ['https://himansh37.github.io', 'http://localhost:3000'] })` — this stops casual browser-based reuse from other sites (defense in depth, not the main fix).

### 2. Stored XSS via deck names in the progress dashboard — **Medium**

**What:** `renderProgressView()` builds each progress card with an `innerHTML` template that interpolates the deck name unescaped:

```js
// frontend/app.js:438-448
card.innerHTML = `
    ...
    <h3>${deckName}</h3>
```

Deck names are fully user-controlled (Save Deck / Rename Deck modal, no validation). A deck named `<img src=x onerror="...">` executes script every time the progress view renders.

**Why it's Medium and not High today:** all data lives in the *user's own* `localStorage`, so right now this is self-XSS — you can only attack yourself. **Why it still matters:** the moment any deck import/share feature exists (it's Tier 2 on your roadmap), a shared deck name becomes a cross-user XSS payload delivered to everyone who imports it. Fix it now while it's a one-line change, not later when it's a real incident.

**This is the only such sink.** Every other `innerHTML`/`insertAdjacentHTML` call in the codebase was checked: they insert static SVG/HTML strings only. All Gemini-generated content (`japanese`, `reading`, `english`, `mnemonic`) is rendered via `textContent` — model output cannot inject markup.

**Fix:** create the `<h3>` with `document.createElement` + `textContent`, or escape `deckName` before interpolation. The deck list already does this correctly (`titleSpan.textContent = deckName`) — match that pattern.

### 3. Third-party scripts with no integrity checks; one unpinned — **Medium**

```html
<script src="https://cdn.tailwindcss.com"></script>              <!-- unpinned, runtime compiler -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>    <!-- unpinned = "latest" -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>  <!-- pinned, no SRI -->
```

**Impact:** None of the three carry a Subresource Integrity (`integrity=`) hash. If any CDN is compromised or serves a tampered file, that script runs with full access to your page and your users' `localStorage`. Separately, `chart.js` with no version pin means a future breaking release silently breaks your progress chart with no code change on your side. Tailwind's Play CDN is explicitly documented as not for production — it ships a large runtime compiler and generates styles at page load.

**Fix:** pin exact versions for all three and add `integrity="sha384-..." crossorigin="anonymous"`. For Chart.js use a pinned URL like `.../chart.js@4.4.x/dist/chart.umd.js`. Longer term, replace the Tailwind Play CDN with a proper build step (or a pinned prebuilt CSS file) — this also unblocks Finding 4.

### 4. No Content-Security-Policy on the frontend — **Medium**

**Live evidence:** GitHub Pages response carries `Strict-Transport-Security` but no `Content-Security-Policy`, `X-Frame-Options`, or `X-Content-Type-Options`.

**Impact:** CSP is the safety net that would have blunted Finding 2 (blocking inline `onerror` handlers) and Finding 3 (restricting which script hosts are allowed). Without it, any injected script runs unrestricted.

**Constraint:** GitHub Pages doesn't let you set response headers, so this must be a `<meta http-equiv="Content-Security-Policy">` tag. That's currently awkward because the Tailwind Play CDN injects styles at runtime, the page uses inline `style=` attributes and one inline `oninput=` handler, and the runtime needs `'unsafe-inline'` for styles. A realistic first CSP would still be valuable: lock `script-src` to `'self'` plus the three pinned CDN hosts, allow `style-src 'self' 'unsafe-inline' fonts.googleapis.com`, and `connect-src 'self' https://koicards-api.onrender.com`. Move the one inline `oninput` handler into `app.js` so `script-src` doesn't need `'unsafe-inline'`.

### 5. Server technology disclosed — Low

**Live evidence:** `x-powered-by: Express` on every backend response. Minor fingerprinting aid for attackers.

**Fix:** `app.disable('x-powered-by')`, or add `helmet()` which also sets a sensible baseline of headers.

### 6. Raw upstream error bodies forwarded to clients — Low

```js
// backend/server.js:68-69
if (error.response) {
    res.status(error.response.status).json(error.response.data);
```

**Impact:** Whatever Google returns on error is relayed straight to the browser. Google's error payloads can include model/project details and internal messages you may not want to expose, and passing through arbitrary upstream status codes leaks information about your quota state.

**Fix:** log the full upstream error server-side; return a small set of generic client-facing messages (e.g. map 429 → "AI service busy, try again", everything else → "Generation failed").

### 7. API key sent as a URL query parameter — Low

```js
// backend/server.js:55
`...generateContent?key=${apiKey}`
```

**Impact:** Query strings routinely end up in proxy, CDN, and hosting logs (Render, Cloudflare in front of it). The key is never exposed to browsers, so this is low — but it widens the blast radius of any log leak.

**Fix:** send it as the `x-goog-api-key` request header instead; Google supports both.

### 8. No lockfile; dependency audit not performed — Low

`backend/` declares `axios ^1.13.2`, `cors ^2.8.5`, `dotenv ^17.2.3`, `express ^5.2.1`, `express-rate-limit ^7.4.0` but no `package-lock.json` is committed. Every Render deploy resolves fresh versions — non-reproducible builds, and a compromised or broken patch release gets picked up automatically.

**Fix:** commit `package-lock.json`, and run `npm audit` (couldn't be done here — no `npm` on this machine). Consider running it in CI on every push.

### 9. Rate limits are in-memory — Low (already known)

Counters live in server memory and reset whenever Render's free tier sleeps or redeploys. Already documented in `API_QUOTA_PLAN.md` with a phased plan (Upstash Redis). Noting it here for completeness.

**Positive:** `app.set('trust proxy', 1)` is the correct value. With exactly one trusted hop, Express reads the client IP from the address the proxy itself appended, so a client cannot spoof `X-Forwarded-For` to dodge the per-IP limit. (Reasoned from configuration, not live-tested — see note at top.)

### 10. No input length limits; reserved deck names silently fail — Low

No `maxlength` on the deck-name input or the four card-edit fields. A very long name bloats `localStorage` (5MB cap per origin) and overflows the UI. Separately, decks are stored as keys on a plain object (`decks[name] = cards`), so a deck named `__proto__` sets the object's prototype instead of a key and is silently lost on save — a robustness bug, not a security one, since nothing server-side is involved.

**Fix:** `maxlength` (e.g. 60 for names) and trim; reject empty/reserved names, or store decks in a `Map` / `Object.create(null)`.

### 11. Frontend can be framed — Low

No `X-Frame-Options` / `frame-ancestors`. Clickjacking impact is minimal because there's no login and no destructive server-side action to hijack. Would be covered by the `frame-ancestors` directive if you add the CSP from Finding 4.

---

## What was checked and passed

Listed so you know these weren't skipped:

- **Secrets:** scanned the working tree *and every commit in git history* for Google API key patterns, bearer tokens, and generic `api_key=` assignments — **nothing found**. A `.env` file has **never** been committed. `.gitignore` covers `.env` and `node_modules/`.
- **Public repo surface:** the personal/test images (`me.png`, `goat.jpg`, etc.) flagged earlier are still correctly excluded — only 19 intentional files are tracked. (`Preliminary_Lesson.pdf` is now public by your decision.)
- **Transport:** frontend served over HTTPS with HSTS (`max-age=31556952`); plain `http://` returns a `301` to HTTPS (live-verified). Backend is HTTPS via Cloudflare/Render.
- **API key handling:** never sent to the browser; only ever read from `process.env` on the server. The proxy architecture itself is the right design.
- **Model output rendering:** every field Gemini returns is rendered with `textContent`, so a malicious or malformed model response cannot inject HTML.
- **DOM sinks:** no `eval`, `new Function`, `document.write`, or `javascript:` URLs anywhere. All `innerHTML` uses except Finding 2 insert static strings.
- **Storage robustness:** `localStorage` reads are wrapped in `try/catch` around `JSON.parse` (`storage.js`), so corrupted storage degrades gracefully instead of crashing the app.
- **Service worker:** explicitly skips non-`GET` requests, so `/api/generate` is never cached; nothing sensitive is cached; cross-origin assets cache as opaque responses (standard, safe).
- **Mnemonic style selector:** the stored preference is validated against the allowlist before use, and generation falls back to a safe default for unknown values.
- **Gemini response handling:** a structured `responseSchema` is requested, and a `JSON.parse` failure is caught and surfaced as a friendly error rather than an unhandled rejection.
- **Outbound links:** the PDF link uses `rel="noopener"` with `target="_blank"`.

---

## Recommended order

1. **Finding 1** — build the Gemini request server-side and validate the image; restrict CORS. This is the one that can actually cost you money/quota.
2. **Finding 2** — one-line `textContent` fix. Do it now; it's a landmine for the deck-sharing feature.
3. **Finding 3** — pin versions + add SRI hashes. Ten minutes of work.
4. **Findings 5, 6, 7** — small backend hardening, can all go in one commit.
5. **Finding 4** — add a `<meta>` CSP once Tailwind is off the Play CDN.
6. **Finding 8** — commit a lockfile and run `npm audit`.
