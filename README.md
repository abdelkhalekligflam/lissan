# Lissan

An Arabic-first language learning application based on the supplied Stitch design, built with Next.js App Router, TypeScript, Tailwind CSS and Supabase. The UI can switch to English or French. Target phrases retain LTR direction.

## Run locally

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Without Supabase variables, discovery mode works on this device using local storage. It does not create an account, does not upload audio, and does not represent cloud-saved XP. Authenticated account data stays separate from discovery progress and is not automatically imported.

**Read [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md) before configuring or deploying the backend.** No production service is automatically provisioned by this repository.

## Included

- Landing page, onboarding and learning dashboard; mobile bottom navigation.
- 3 languages × 3 A1 units × 4 phrases; greetings, café and travel.
- Phrase audio using browser speech synthesis, slow playback, examples.
- Multiple choice, text entry and accessible click/drag sentence building.
- Server-calculated quiz scores; first-completion-only XP; sequential unlocks.
- Flashcard review intervals, matching, speed and memory games; no game XP.
- Weekly XP leaderboard, achievements, progress heatmap and settings.
- Email/password and Google OAuth, email confirmation and password reset.
- Turnstile, Upstash rate limits, secure cookies, nonce-based CSP, RLS policies.
- Microphone recording, real waveform and playback, optional browser speech recognition; private audio upload through a verified Edge function.
- A pricing page that clearly labels Premium as upcoming. No payments are collected.

## Important scope

This is an initial A1 curriculum, not a complete path to fluency. Level selection stores a preference; it does not claim to provide a placement test or advanced content. Daily goal is a learning preference, not a measured timer. Flashcards may also be manually practised before their due date.

Browser speech recognition is a transcription aid, **not phonetic assessment**. Its availability depends on the browser, may involve browser-vendor processing and requires user permission. No pronunciation score is fabricated. Professional assessment, paid checkout, advanced curricula and scheduled notification delivery require additional services/content before release. Current content is not a certified examination.

## Security and data flow

The browser submits answers, never XP. `/api/learning` verifies the user, validates the request, calculates the score against the immutable curriculum and calls a service-role-only RPC. The RPC locks the profile row, checks lesson prerequisites and awards XP once. Clients can update only allowed profile columns; no score-bearing table accepts client writes. Leaderboard reads use a server-only client and return names/weekly XP, never account identifiers.

Rate limits are implemented in `lib/security.ts`: general IP budget 100/min through `proxy.ts`, auth 5/15min/IP, quiz 60/min/user, upload 10/min/user. The Edge function also independently verifies tokens, rate-limits, inspects audio bytes and enforces 5 MB. Redis failure/missing configuration fails closed. Run behind a trusted reverse proxy (Vercel) that supplies the client IP headers; do not trust attacker-controlled forwarded headers on a custom host.

Tables and private audio reads use RLS. Recordings can be written only through the rate-limited server/Edge flow. The `audio` bucket is public, so upload only lesson audio there. JWT claims/user metadata are never used to grant subscriptions or privileges. Rendering uses React text escaping and no raw user HTML. Secrets are ignored by Git and never included in public variables.

## Validation

```powershell
npm run typecheck
npm run test:db
npm run build
npm audit --omit=dev
```

`test:db` runs the migrations and seed inside an in-memory PostgreSQL-compatible PGlite database with minimal auth/storage fixtures. It checks cross-user isolation, direct XP write denial, RPC access, duplicate awards, lesson locks, review intervals and private recording reads. It does not replace testing the real Supabase Auth/Storage integrations with two accounts after setup.

```powershell
npm run seed:generate
npm run types:generate -- YOUR_SUPABASE_PROJECT_REF
```

Seed content derives from `lib/learning/content.ts`. The committed database types are generated from the migration schema in PGlite. Use the official Supabase type generator after applying the migration; do not invent a project ref. Keep curriculum changes and the generated seed in the same commit.

## Folder structure

- `app/`: page, auth callbacks, reset password, authenticated API routes.
- `components/`: application UI, authentication dialog, pronunciation studio.
- `lib/learning/`: curriculum and answer normalisation.
- `lib/supabase/`: cookie-based server client and isolated privileged client.
- `lib/security.ts`: rate limiting, origin checks and CAPTCHA verification.
- `supabase/`: migration, seed, Edge function.
- `scripts/`: seed/type generation and database regression checks.

## Release checks

Run the manual checklist, exercise signup/confirmation/reset/Google login on the deployed domain, verify two-user isolation, check 429 responses, validate microphone permissions on desktop/mobile, and review translations. SQL and build checks alone do not establish production readiness.
