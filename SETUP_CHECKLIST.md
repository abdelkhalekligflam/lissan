# Lissan — manual setup

The application code is prepared; cloud services, OAuth, secrets, domains and emails must be configured by the project owner. Never paste service-role keys or Redis/Turnstile secrets into a chat, commit, screenshot or public env variable. Use a new Supabase project for this app, not a database containing another app’s production data.

## 1. Supabase project and environment

1. Supabase Dashboard → New project. Name `Lissan`; select your region and a strong database password.
2. Project → Connect → App Frameworks / API Keys: copy Project URL and a browser-safe key. `NEXT_PUBLIC_SUPABASE_ANON_KEY` accepts the legacy anon key or the current publishable key. **Never use a secret/service_role key there.**
3. Project Settings → API Keys → legacy service-role key: keep this only in `SUPABASE_SERVICE_ROLE_KEY` on the server.
4. Copy `.env.example` to `.env.local`. Set:

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_BROWSER_SAFE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
```

TODO (manual): replace all owner-supplied values. Restart `npm run dev` after changes.

## 2. Apply the migration and seed

Recommended: Dashboard → SQL Editor → New query. Execute the entire file `supabase/migrations/20261008205134_initial_lissan.sql`, then execute `supabase/seed.sql`. Run the migration once; the seed is repeatable. The migration creates all 12 tables, profile trigger, protected RPCs, indexes, RLS policies and storage buckets.

Alternatively, after reviewing your installed CLI help:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --include-seed
```

Do not use `db reset` on a remote production database. Generate actual schema types after migration:

```powershell
npm run types:generate -- YOUR_PROJECT_REF
```

If using SQL Editor instead of CLI, the SQL will not record CLI migration history automatically. Choose one deployment method before future migrations.

Verify counts:

```sql
select 'languages' as item, count(*) from public.languages
union all select 'lessons', count(*) from public.lessons
union all select 'exercises', count(*) from public.exercises
union all select 'flashcards', count(*) from public.flashcards;
-- Expected: 3 languages, 9 lessons, 36 exercises, 36 flashcards.
```

## 3. Auth settings, URLs and Google OAuth

Dashboard → Authentication → URL Configuration:

- Development Site URL: `http://localhost:3000`.
- Redirect URLs: `http://localhost:3000/auth/callback`, `http://localhost:3000/auth/callback?next=/reset-password`, `http://localhost:3000/auth/confirm`.
- Before production, change Site URL to `https://YOUR_DOMAIN` and add the same exact callback paths for that domain. Avoid broad wildcard redirects.

Dashboard → Authentication → Sign In / Providers → Email:

- Enable email/password and **Confirm email**.
- Require a password length of at least 8; enable supported compromised-password protection if available on your plan.

Dashboard → Authentication → Rate Limits:

- Review all displayed limits, especially email sending, sign-in, token verification and password recovery. Set per-IP sign-in/signup/recovery to 5 per 15 minutes where the dashboard supports that control; keep remaining limits suitably low for your actual traffic. Built-in Auth limits do not protect custom API/Edge endpoints; Redis code covers those.

Google Cloud Console → APIs & Services → OAuth consent screen / Credentials → Create OAuth client → Web application:

- Authorised JavaScript origin: `http://localhost:3000`, later `https://YOUR_DOMAIN`.
- Authorised redirect URI: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
- Configure consent/test users and publish the OAuth consent configuration when ready.

Supabase Dashboard → Authentication → Sign In / Providers → Google:

- Enable Google, enter Client ID and Client Secret from Google Cloud.

## 4. Turnstile CAPTCHA (required for auth forms)

Cloudflare Dashboard → Turnstile → Add widget:

- Widget name `Lissan`; mode `Managed`.
- Hostnames: `localhost` for development and `YOUR_DOMAIN` for production.
- Copy Site key → `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- Copy Secret key → `TURNSTILE_SECRET_KEY` (server only).

Supabase Dashboard → Authentication → Attack Protection → CAPTCHA protection:

- Enable CAPTCHA, provider **Cloudflare Turnstile**, paste the same secret key.

TODO (manual): configure both Cloudflare and Supabase. Forms remain disabled until a valid widget token exists. The server verifies success and hostname before forwarding CAPTCHA to Auth. If the dashboard labels move, search Authentication settings for CAPTCHA or bot protection.

## 5. Upstash Redis (required, fail closed without it)

Upstash Console → Redis → Create Database:

- Name `lissan-ratelimit`; choose a region close to the host.
- Database → REST API → copy URL/token.
- Add server-only `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to `.env.local` and hosting environment.

Implemented limits: auth 5/15min/IP; quiz 60/min/user; recording 10/min/user; general API 100/min/IP. Redis errors return 503; exhausted limits return 429, `Retry-After` and an Arabic retry message. Account APIs also key a general bucket by verified user ID.

## 6. Deploy the recording Edge function

CLI authentication/linking must already be complete. Inspect `npx supabase secrets set --help` and `npx supabase functions deploy --help` for your CLI version.

Create a temporary local file `edge-secrets.env` containing only:

```dotenv
SITE_URL=http://localhost:3000
UPSTASH_REDIS_REST_URL=YOUR_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN=YOUR_REDIS_REST_TOKEN
```

```powershell
npx supabase secrets set --env-file edge-secrets.env
npx supabase functions deploy pronunciation
Remove-Item edge-secrets.env
```

TODO (manual): for production replace `SITE_URL` with `https://YOUR_DOMAIN` and set secrets again. Supabase supplies its own URL/anon/service-role environment values for Edge functions; never expose these to the UI. Function config uses `verify_jwt=false` because `auth.getUser()` explicitly verifies the supplied bearer token inside the function, including newer asymmetric tokens. Do not remove that verification.

Storage → Buckets:

- `audio`: public, 5 MB, audio types only. Use for lesson audio only; current lessons use browser speech synthesis, so no manual audio uploads are required to try them.
- `user-recordings`: **private**, 5 MB, audio types only. Upload requires the verified Edge flow. Never make it public.

## 7. Vercel deployment

Vercel → Add New → Project → Import `abdelkhalekligflam/lissan`.

- Framework: Next.js.
- Root: repository root.
- Build: `npm run build`.
- Install: `npm ci`.
- Project → Settings → Environment Variables: add every variable from `.env.example` for Production and any Preview environment you intentionally configure.
- `NEXT_PUBLIC_SITE_URL` must equal the actual stable deployment origin, e.g. `https://YOUR_DOMAIN` (no trailing slash).
- Keep service-role, Redis token and Turnstile secret **without** `NEXT_PUBLIC_`.
- Redeploy after variable changes. Public values are compiled into the browser bundle.

TODO (manual): update Supabase redirect URLs, Google origins, Cloudflare hostnames and Edge `SITE_URL` to match the deployment. Preview deployments require their own authorised URLs/hostnames; prefer testing with a fixed staging domain.

## 8. RLS and two-user isolation checks

SQL Editor:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
-- Every application table must show rowsecurity=true.

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public','storage')
order by schemaname, tablename, policyname;
```

Review Security Advisors: Dashboard → Database → Advisors / Security. The profile trigger is intentionally privileged and lives in an unexposed private schema; score RPCs use invoker rights and execute only for service_role.

Use two different confirmed users A and B in separate browser profiles:

- Complete a lesson and review cards as A. B must not see A’s XP, progress, reviews, streaks or recordings.
- Query `profiles`, `user_progress`, `flashcard_reviews`, `streaks`, `game_scores` with A’s authenticated client: only A’s rows must be visible.
- Try selecting B’s profile explicitly: no rows.
- Try updating `profiles.xp` and inserting progress directly: denied.
- Try calling `award_lesson` directly with A’s browser token: denied.
- Submit the same passed lesson twice through the app: XP increases only once.
- Request a locked lesson through the API: rejected.
- Get another user’s private recording: denied.
- The weekly leaderboard intentionally shares display names/weekly XP only with signed-in users.

Run local checks too:

```powershell
npm run typecheck
npm run test:db
npm run build
```

## 9. SMTP, domain and HTTPS

Supabase Dashboard → Authentication → Email / SMTP Settings:

- Enable custom SMTP and enter your provider’s host, port, username and password.
- Sender name: `Lissan`.
- Sender address: a verified address such as `hello@YOUR_DOMAIN`.
- Add provider-required SPF/DKIM/DMARC DNS records and send a test.

Authentication → Email Templates:

- Signup confirmation link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`.
- Password recovery link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`.
- Keep tokens in links, not logs. Test expiry and a second click on the same token.

Vercel → Project → Settings → Domains → Add domain, configure the requested DNS values, verify the TLS certificate. Use HTTPS in every production URL. CSP/HSTS/security headers are supplied in code; verify them on the deployed host. On a custom host, configure trusted client-IP headers before exposing the rate limiter.

## 10. Final live checks and honest limitations

- Signup → email confirmation → onboarding → quiz → sign out/in: progress persists.
- Password reset and Google OAuth: finish on the correct domain.
- Trigger 429 on auth/general/quiz/Edge routes: correct Retry-After, no XP change.
- Test desktop and phone layouts; AR must be RTL, target phrases LTR, EN/FR LTR.
- Test microphone allow/deny, record/stop, playback and a private upload.
- Speech recognition support varies; there is no professional pronunciation score yet.
- Premium is upcoming; no subscriptions are activated and no payment is taken.
- Current curriculum: 9 A1 lessons. Intermediate/advanced preference is not extra course content.
- Notifications and offline account sync are not shipped as production features.
- Review translated lesson content with a language teacher before broad release.
