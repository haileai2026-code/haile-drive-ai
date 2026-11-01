# Deploy עצמאי — בלי Lovable

Haile Drive AI רץ על Cloudflare Workers + Supabase + xAI.
אין צורך ב-Cloud Secrets של Lovable.

## 1. GitHub Secrets (חובה ל-deploy)

Repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | מאין |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | טוקן עם הרשאת Workers Edit |
| `CLOUDFLARE_ACCOUNT_ID` | מה-dashboard של Cloudflare |
| `XAI_API_KEY` | מ-console.x.ai |
| `VITE_SUPABASE_URL` | https://xxx.supabase.co |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon key |
| `VITE_SUPABASE_PROJECT_ID` | מזהה הפרויקט |
| `SUPABASE_URL` | אותו URL |
| `SUPABASE_PUBLISHABLE_KEY` | אותו anon |
| `SUPABASE_PROJECT_ID` | אותו מזהה |
| `SUPABASE_SERVICE_ROLE_KEY` | service role — רק שרת |
| `DAILY_API_KEY` | רק אם יש שיעור חי |

## 2. הרצה

Actions → הרץ **Deploy to Cloudflare Workers** → Run workflow

או push ל-`main`.

אחרי הרצה מוציל URL מסוג:
`https://haile-drive-ai.<account>.workers.dev`

## 3. Secrets ב-Cloudflare (AI בשרת)

אחרי ה-deploy הראשון:

```bash
npx wrangler secret put XAI_API_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put DAILY_API_KEY
```

**Phone OTP (server only, required before phone login is enabled):**
- `OTP_PEPPER` — at least 32 random characters (`openssl rand -hex 32`); no value in the repo. Without it OTP requests fail closed. The IP-hash key is derived from it (HKDF), so no separate env var is needed.
- CAPTCHA must be in place before phone login / Twilio is turned on.
- Phone login (HB-01) is gated by `PHONE_LOGIN_ENABLED=on` **and** `TURNSTILE_SECRET_KEY` (server only) **and** a non-empty `TURNSTILE_ALLOWED_HOSTNAMES` (at least one entry after trimming); otherwise phone OTP request/verify return 403. In addition, every `requestPhoneOtp` call must carry a Cloudflare Turnstile token, which the server verifies via `https://challenges.cloudflare.com/turnstile/v0/siteverify` (secret, token, `remoteip` from `src/lib/client-ip.ts`, 5 s timeout). It requires `success=true`, `hostname` in `TURNSTILE_ALLOWED_HOSTNAMES` (comma-separated, required) and `action=phone_otp` and `challenge_ts` no older than `TURNSTILE_MAX_AGE_SECONDS` (default 300, `0` disables); hostnames compare case-insensitively. Any error/timeout fails closed (403). Cloudflare `error-codes` are logged server-side only, never returned. The no-IP 400 (production) is checked before siteverify so no token is spent.
- Client widget: set `VITE_TURNSTILE_SITE_KEY` (public site key, build-time). Without it no widget renders and phone OTP requests are rejected. If a CSP is added, allow `https://challenges.cloudflare.com` for script-src and frame-src.
- In production (`VERCEL=1` or `NODE_ENV=production`) an SMS request without a resolvable client IP is refused with 400; outside production IP-less requests share one strict per-IP bucket, so the per-IP limit is never disabled.
- Deploy order: PR #10 (beta flag guard) must be merged before #6 is deployed.
- Edge rate limit: add a Vercel WAF / Firewall rate-limit rule on the server-function route that serves `requestPhoneOtp` and `verifyPhoneOtp` (per IP, e.g. 10 req/min), in addition to the DB caps.
- Pre-GA items for `verifyPhoneOtp` (not in HB-01): per-IP verify limit (~20 failures/hour, same IP hash as request); Turnstile on verify at least after the first failure; lockout keyed per phone+IP (not only per phone) so an attacker cannot lock out a victim's number.
- Vercel preview test checklist (Cloudflare test keys, preview env only; never in production):
  - [ ] Always-pass sitekey `1x00000000000000000000AA` + secret `1x0000000000000000000000000000000AA`; preview `TURNSTILE_ALLOWED_HOSTNAMES` includes `example.com` (the test-key hostname) on preview ONLY.
  - [ ] Always-fail secret `2x0000000000000000000000000000000AA` => 403, no `phone_login_requests` row.
  - [ ] Spent-token secret `3x0000000000000000000000000000000AA`, and replaying a real token => 403.
  - [ ] Sitekeys `2x00000000000000000000AB` (always blocks) and `3x00000000000000000000FF` (forces interactive) render/behave correctly; send button stays disabled without a token.
  - [ ] Missing token, wrong hostname, wrong action, siteverify timeout => 403.
  - [ ] CSP (if any) allows `https://challenges.cloudflare.com` (script-src, frame-src).
  - [ ] Widget refreshes after the 300 s token expiry (expired-callback disables send).
  - [ ] RTL layout and mobile viewport.
  - [ ] Production `TURNSTILE_ALLOWED_HOSTNAMES` lists production hosts only (no `example.com`, no preview hosts).
- Caps-hit alerting (R4-4) is a follow-up; acceptable once Turnstile is in place.
- Client IP is read from ONE header chosen by platform (`src/lib/client-ip.ts`): on Vercel (`VERCEL=1`, set by the platform) only `x-vercel-forwarded-for`; on Cloudflare (`EDGE_PLATFORM=cloudflare`, set by ops only if the origin accepts Cloudflare traffic exclusively) only `cf-connecting-ip`; behind another proxy (`TRUSTED_PROXY=on`) `x-real-ip`, else the rightmost `X-Forwarded-For`; otherwise no IP (production: request refused with 400; dev: shared bucket).

ה-workflow מעביר גם env בזמן deploy; ה-secrets של wrangler נשארים ב-Worker.

## 4. ריצה מקומית (בלי Lovable)

```bash
git clone https://github.com/haileai2026-code/haile-drive-ai.git
cd haile-drive-ai
cp .env.example .env
# מלא XAI_API_KEY + Supabase
bun install
bun dev
```

גש ל-`/admin/ai-agent`.
