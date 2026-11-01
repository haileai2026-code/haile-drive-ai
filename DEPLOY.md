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
- Phone login is **hard-disabled in code** (R5-1): `phoneLoginEnabled()` always returns false, so phone OTP request/verify always return 403. `PHONE_LOGIN_ENABLED` and `TURNSTILE_SECRET_KEY` have **no effect** until server-side Turnstile siteverify (token + `remoteip`, hostname/action checks, fail closed) and the client widget land in a separate PR. No client CAPTCHA token is read today.
- In production (`VERCEL=1` or `NODE_ENV=production`) an SMS request without a resolvable client IP is refused with 400; outside production IP-less requests share one strict per-IP bucket, so the per-IP limit is never disabled.
- Deploy order: PR #10 (beta flag guard) must be merged before #6 is deployed.
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
