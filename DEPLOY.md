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
