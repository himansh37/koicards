# Protecting Your Free Gemini API Quota — A Real Plan

You said this in plain terms: you're using a free-tier API key, you don't want to pay, and you're worried it'll run dry. This doc explains exactly why that worry is justified *right now*, and lays out a staged plan to fix it — written so you don't need to already know what "rate limiting" means to follow it.

## Why this is urgent, not theoretical

Right now, here's what's actually true about your deployed backend (`backend/server.js`):

1. It has exactly one route, `POST /api/generate`, and its only job is: take whatever is sent to it, add your secret Gemini API key, and forward it to Google.
2. It accepts requests from **any website, any script, any person** — `app.use(cors())` with no restriction means there's no origin check at all.
3. It does **zero validation** of what's sent — whatever JSON body arrives gets forwarded to Gemini as-is.
4. It has **zero rate limiting** — nothing stops one visitor, or one script, from calling it 1,000 times in a row.
5. The URL itself (`https://koicards-api.onrender.com/api/generate`) is sitting in plain text inside your public frontend JavaScript, so it's not even hidden — anyone who opens your browser's dev tools for ten seconds can find it and call it directly from a terminal, completely bypassing your website.

Put together: **your Gemini key is currently a public, unmetered resource.** It's not that someone *might* abuse it — it's that nothing is stopping them, on purpose or by accident (a bug in your own frontend that retries too aggressively would do the same damage). This is the single most important thing to fix before you tell people about this site, ahead of any feature work.

## Two different problems, easy to confuse

- **Google's own limit on your API key** — how many requests-per-minute and requests-per-day Google allows for your key on the free tier. You don't control this number, and it changes over time, so check the current numbers yourself in [Google AI Studio](https://aistudio.google.com/) rather than trusting a number written here. This is the *ceiling*.
- **Your own app-level limit** — how many requests *you* allow any single visitor to make. This is what you actually control, and it's what stops one person (malicious or just a confused script) from eating the whole ceiling before anyone else gets a turn.

Your idea of "5 requests per user per day" is aimed at the second problem, which is exactly the right instinct. The hard part is: **what does "one user" even mean**, when nobody logs in?

## Why "5 per user" is harder than it sounds (and how to do it anyway)

There's no login system yet, so there's no real identity to attach a limit to. A few options, in order of how easy they are to cheat:

| Approach | Can a user get around it? | Effort |
|---|---|---|
| Count in the browser (localStorage) | Yes — clear storage, use incognito, use a different browser. Trivial to bypass, and useless against someone calling the API directly (bypassing your site entirely). | Low, but **don't rely on this alone** |
| Count by IP address, on the server | Harder — needs a new IP (VPN, mobile data vs wifi, etc). Not perfect: people sharing an IP (same office, same college wifi, same family router) share a limit too. | Low |
| Count by a random ID stored in the browser, on the server | Harder still, but still resettable by clearing storage. Good *combined* with IP, not instead of it. | Low-medium |
| Real user accounts (sign in) | Very hard to bypass — a real identity per person. | Medium-high, needs a database |

**The rule to remember: any check that only lives in the browser can be turned off by the person you're trying to limit.** The enforcement has to happen on your server, where the visitor can't touch it. The browser can still *show* "you've used 4 of 5 today" for a nice UI, but the server has to be the one that actually says no.

## The plan, in three phases

### Phase 0 — do this before/at launch (today, ~30 minutes, $0)

Two changes to `backend/server.js`:

**1. Server-side IP rate limiting**, using a well-known, free npm package (`express-rate-limit`). Roughly:

```js
const rateLimit = require('express-rate-limit');

const generateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5,                        // 5 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "You've reached today's free limit. Please try again tomorrow." }
});

app.post('/api/generate', generateLimiter, async (req, res) => {
  // ...existing code...
});
```

That's your "5 per user per day" — enforced as "5 per IP address per day," which is the closest honest approximation available without accounts. Good enough to stop casual abuse and runaway bugs.

**2. A global daily safety net**, separate from the per-IP limit. This protects against a different scenario: what if the app suddenly gets shared somewhere and *200 different real people* show up in one day, each well under their own 5-request limit, but together still blow past what Google allows you for free? A second limiter with no per-IP key, just a shared counter, e.g. `max: 150` total requests/day across everyone, caps your worst-case cost at a number you chose on purpose — not a number you find out about from a billing alert.

**3. Basic payload validation.** Right now the backend forwards *anything* sent to it. Add a quick check that the body roughly matches what your own frontend actually sends (has a `contents` array, has image data under some reasonable size cap, doesn't ask for a huge `generationConfig`). This closes off the "someone uses your backend as a free general-purpose AI API for unrelated things" hole.

**4. Matching frontend UX.** When the backend replies with a 429 (rate-limited) status, show the user a clear, friendly message — "You've used today's free flashcard generations, come back tomorrow!" — instead of the generic error message. Makes the limit feel like a considered design choice instead of the app being broken.

**Honest limitation of Phase 0:** the counters live in the server's memory. Render's free tier spins your server down when it's idle and restarts it on the next request — which resets the counters. For a low-traffic app this is a minor, acceptable gap (worst case, a determined abuser could wait for a restart to reset their count) — not worth solving on day one, but worth knowing about.

### Phase 1 — once the app has real traffic (persistence)

Move the counters out of server memory and into a small persistent store, so limits survive restarts and (if you ever run more than one server instance) stay consistent across all of them. **Upstash Redis** is the natural fit here — it has a genuinely usable free tier, works over a simple REST API (no server setup), and there's a small official package (`@upstash/ratelimit`) built exactly for this use case. This is a small, contained upgrade to Phase 0 — same idea, sturdier foundation.

At this stage also add **usage monitoring**: log (or even just print) your daily total Gemini calls somewhere you'll actually see it, so you notice a usage spike before Google's dashboard surprises you.

### Phase 2 — once you have accounts (see `ROADMAP.md`, Tier 3)

This is the "correct" long-term answer, and it's also the point where "5 per user" stops being an approximation and becomes literally true — because a user will finally mean something specific (an actual account), not an IP address that might be a whole office building or might be a phone that changes IP every hour on mobile data. At that point you could also offer generous limits to real, verified users and tighter ones to anonymous/guest usage — and even let power users plug in their *own* free Gemini key if they want unlimited generations without costing you anything. This phase is naturally the same milestone as the accounts work in the roadmap — you don't need to build it twice.

## What I'd actually do, in order

1. **Ship Phase 0 before or immediately after your first public link goes out.** It's small, it's free, and it directly closes the exposure described at the top of this doc. Say the word and I'll implement it — it's a contained change to one file.
2. Keep an eye on Google AI Studio's usage dashboard for the first couple of weeks after launch, just to get a feel for real traffic patterns.
3. Move to Phase 1 only once you notice the free-tier server restarts are actually causing visible problems (probably not for a while, at low traffic).
4. Fold Phase 2 into the accounts work whenever you decide to build that — don't build a separate auth-lite system just for rate limiting; let one piece of work solve both problems.
