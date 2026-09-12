# KoiCards — Where This Could Go

Ideas for making the app better for users, grouped by effort vs. impact. Not a commitment or a deadline list — a menu to pick from once the web launch is stable. Read `FEATURES.md` first for what already exists.

---

## Tier 1 — Quick wins (small effort, real polish)

These are things a new visitor would notice within their first minute on the site.

- **A demo deck out of the box.** Right now a first-time visitor sees an empty "No decks yet" state and has to upload an image before they can see what the app even does. Ship one pre-loaded sample deck (e.g., common greetings) so people can try studying/testing *immediately*, before they trust the app enough to upload their own photo.
- **A 10-second onboarding.** Three or four dismissible tooltips pointing at "Choose Image," the flip-to-reveal card, and the streak badge. Most flashcard-app churn happens because people don't realize what to click first.
- **Light/dark theme toggle.** *(Built once already, then deliberately reverted — nobody was using it. Left unimplemented on purpose until there's real demand. Notes below are so a future attempt doesn't have to re-discover the gotchas.)* The CSS variables and `DeckManager.getTheme()/setTheme()` already exist and work correctly (`storage.js`, plus a `[data-theme="light"]` block in `style.css`). Wiring a button to them is genuinely close to free — the real cost is everywhere else:
  - Several CSS rules hardcode dark colors directly instead of using the theme variables that already exist for this exact purpose: flashcard front/back (`.front`/`.back`), `.modal-content`, `#deck-name-input`, `.progress-ring__background`, `.progress-score`. These need to switch to `var(--card-front-bg-color)` etc. or light mode looks broken (dark cards floating on a light page).
  - The much bigger cost: `index.html` uses hardcoded Tailwind utility classes for text color throughout (`text-white`, `text-white/70`, `text-white/90`, `text-gray-200`, `text-gray-300`, etc.) on headings, buttons, and modal copy. Tailwind's CDN build has no idea a custom `[data-theme]` system exists, so none of these adapt automatically. Fix is either a set of `[data-theme="light"] .text-white { color: var(--text-primary-color); }`-style overrides in `style.css` (works, but is a blunt "catch every white-ish class" approach), or replacing the Tailwind color classes with theme-aware inline styles/custom classes one by one (cleaner, much more editing).
  - Button backgrounds (`bg-white/5`, `border-white/10`, etc.) have the same problem in the other direction — a "glass on dark" look that may not read as "glass" on a light background without its own pass.
  - Put the toggle button's `data-theme` attribute on `<html>` (`document.documentElement`), not `<body>` — keeps it the single source of truth and matches how `:root` CSS variables are scoped.
- **Per-card editing.** Right now, fixing one wrong translation in a 20-card deck means regenerating the whole thing. A small "edit" pencil per card (editing japanese/reading/english/mnemonic in place) is a big quality-of-life win for very little code.
- **Search/filter on the deck list.** Once someone has 15–20 decks, scrolling through 6-per-page pagination gets old fast. A simple text filter fixes this cheaply.
- **"Last studied" / "Last tested" timestamps** on deck and progress cards — helps users see what's gone stale and needs review.
- **Real PWA install support.** Add an actual `manifest.json` + a minimal service worker (even just caching the app shell for offline access). This turns the currently-dead install button into something that actually works, and is also good groundwork for the mobile-app phase you mentioned — a properly installable PWA is most of the way to a wrapped mobile app already.

## Tier 2 — Medium bets (a real weekend project each)

These change what kind of app this *feels* like to a serious learner.

- **Real spaced repetition (SM-2 or a simplified Leitner system).** This is the single most credibility-building change you could make. Right now "Repeat" just reshuffles a card a few positions later in the same session — it has no concept of tomorrow. Swapping in even a simple day-based scheduling algorithm (each card gets a "next due" date based on how well you knew it) is what separates a toy from a tool serious learners will actually stick with. Anki, Duolingo's review queue, and every respected flashcard app are built around this idea.
- **JLPT level tagging.** Ask Gemini to also classify each generated word by rough JLPT level (N5–N1) and let users filter/study by level. Cheap to add (one more field in the existing prompt/schema) but meaningfully increases perceived quality for a Japanese-learning audience specifically.
- **Kanji stroke-order mini-diagrams** on the back of a card. A nice differentiator, especially for beginners — there are free public stroke-order data sources (e.g., KanjiVG) you could pull from without hitting your own AI quota.
- **Daily reminder notifications** (browser push, or just a gentle in-app nudge) tied to the streak system that already exists — "your streak ends in 3 hours."
- **Deck sharing via link/import**, building on the JSON export that already exists — add a matching "Import JSON" button, and later a shareable link so one user's deck can seed another user's account.

## Tier 3 — Big bets (foundational — these unlock everything else, including mobile)

You said you're thinking ahead about users — these are the moves that actually determine whether the app can grow past "a cool tool I use on one browser."

- **User accounts + cloud sync.** This is the big one, and honestly it's the thing everything else is downstream of. Right now all data lives in one browser's `localStorage` — a user who switches phones, clears their cache, or wants to use the app on both laptop and phone loses everything or has two disconnected data sets. The moment you build a mobile app, this becomes non-optional: you can't have "your decks" mean something different on web vs. mobile. A lightweight auth provider (Firebase Auth, Supabase Auth, or even a simple email-magic-link flow) plus a small database to mirror what `DeckManager` already does locally is the natural next foundation. This is also what makes the rate-limiting problem in `API_QUOTA_PLAN.md` solvable *properly* instead of just IP-based guessing.
- **Community decks.** Once accounts exist, let users optionally publish a deck publicly (with a name, description, maybe a JLPT-level tag) and let others browse/import them. This is a classic growth loop — user-generated content that brings in new users without you generating any of it yourself.
- **Leaderboards / shared streaks with friends.** Social pressure is a proven retention mechanic for habit apps (Duolingo's entire growth engine leans on this). Doesn't need to be complex — even a simple "friends" list comparing streaks would do a lot.
- **An admin/usage dashboard for yourself.** Once you have a database anyway (from accounts), a simple internal page showing daily active users, decks created, API calls made, and error rates turns "is the app healthy" from a guess into something you can actually see.
- **The mobile app itself.** Once there's real cloud sync, wrapping the existing UI with Capacitor (or rebuilding key screens in React Native, reusing the same backend) becomes a much smaller lift than it would be today, because the hard problem — "where does the data live" — is already solved.

---

## Suggested order

If I were sequencing this myself: **Tier 1 items now** (cheap, immediate polish for launch) → **spaced repetition next** (biggest credibility jump for the least architectural change) → **accounts + sync** (once you're confident enough people are using the web app to justify the investment, and before you start the mobile app, not after).
