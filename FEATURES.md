# KoiCards — What's In The App Today

A snapshot of everything the app currently does, as of the first deployable version. Written so you (or anyone else) can see the full picture in one place.

## Core idea
Upload a photo of Japanese text (a sign, a textbook page, a menu, anything). An AI vision model (Google Gemini, called through your own backend so the API key stays private) reads the Japanese, and returns a set of flashcards — each with the original Japanese, its reading in hiragana, an English translation, and a short Hinglish mnemonic to help it stick.

## Feature by feature

### 1. Flashcard generation
- Upload any image → backend forwards it to Gemini with a structured prompt → gets back a JSON array of `{ japanese, reading, english, mnemonic }` objects.
- Handles multiple words/phrases per image in one request.
- Shows a loading state and a clear error message if generation fails (network issue, bad image, API problem).

### 2. Studying
- One card at a time, large and centered, front (Japanese + reading) → click/tap or press Enter/Space to flip → back (English + mnemonic).
- A speaker icon plays the Japanese reading aloud using the browser's built-in text-to-speech (no extra service, free).
- Three response buttons after each card — **Don't Repeat**, **Repeat**, **Repeat Frequently** — control how soon that card reappears later in the same session (re-inserted a few cards later, rather than a real spaced-repetition schedule — see the roadmap doc for why this matters).
- A star button lets you mark any card as "hard" — starred cards automatically collect into a built-in **Hard Words** deck you can study or test separately.
- Every 10 cards studied (or at the end of a deck), a full-screen motivational quote appears as a short break.

### 3. Decks
- **Save Current Deck** turns whatever you just generated into a named, permanent deck.
- **Rename**, **Delete**, and **Load** any saved deck.
- Drag-and-drop to reorder your deck list.
- Decks paginate at 6 per page once you have more than that.
- **Export JSON** downloads the current card set as a `.json` file (useful as a backup, or to hand to someone else).

### 4. Testing
- Pick one or more decks, then choose a direction: **Japanese → English** or **English → Japanese**.
- Multiple-choice, 4 options per question, distractors pulled from the same deck.
- Immediate color feedback (green = correct, red = your wrong pick, with the right answer also highlighted).
- End-of-test summary: score, time taken, and a full question-by-question review.
- Every completed test is saved to a permanent history, per deck.

### 5. Progress dashboard
- One card per deck showing a circular progress ring (average score across all tests on that deck), best score, and number of tests taken.
- Click a deck's card to see a line chart of score-over-time (needs at least 2 completed tests to appear).
- Also drag-and-drop reorderable, also paginated at 6 per page.

### 6. Streaks
- A badge in the top-right tracks consecutive days of activity (studying or testing).
- Resets automatically if a day is missed; increments once per calendar day.

### 7. Look & feel
- Dark, glassy, "Google Material You"–inspired UI (Tailwind CSS via CDN), custom fonts (Inter/Outfit), subtle GSAP animations for the motivational overlay.
- Fully responsive down to phone width — layout, font sizes, and button stacking all adapt under 768px.
- A sakura-blossom background image adds atmosphere to Test Mode specifically.

### 8. Installable & offline-ready
Installable as a PWA. `manifest.json` and service worker (`sw.js`) are implemented — network-first caching with offline fallback.

### 9. First-visit demo deck
New visitors with an empty account are automatically given a small pre-loaded "Japanese Greetings" deck (5 common phrases), so there's something to study and test immediately, before ever uploading an image.

### 10. API abuse protection
The `/api/generate` endpoint is rate-limited server-side: 5 requests per IP per 24 hours, plus a 150-requests-per-day global cap shared across all visitors, protecting the free Gemini quota from runaway or malicious use. See `API_QUOTA_PLAN.md` for the full reasoning and future phases.

## What it is *not* (yet) — important context
- **No accounts, no cloud sync.** Every deck, every test result, every streak lives only in that one browser's `localStorage`. Clear your browser data, switch devices, or use a different browser, and it's all gone. This is the single biggest structural limitation right now — see `ROADMAP.md`.
- **No real spaced repetition.** The "Repeat" buttons just reshuffle the current session; they don't schedule a card to come back tomorrow or next week the way apps like Anki do.

## Tech stack (for reference)
- **Frontend:** plain HTML/CSS/JS (no framework, no build step) + Tailwind CDN + Chart.js + GSAP. Lives in `frontend/`.
- **Backend:** a small Express server (`backend/server.js`) with one route, `POST /api/generate`, whose only job is to hold the Gemini API key server-side and forward the request. Currently deployed on Render.
- **Storage:** browser `localStorage`, wrapped by a small `DeckManager` class (`frontend/storage.js`) — no database anywhere.
