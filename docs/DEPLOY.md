# Deploying Ghostel

## Production environment (`.env.production.example`)
The server reads its settings from environment variables, or from `.env` next to `package.json` (`pnpm start` loads it).
1. On the server: `cp .env.production.example .env`, then `chmod 600 .env`.
2. Fill in the values:
   - `POSTGRES_PASSWORD` and the same password in `DATABASE_URL` (generate with `openssl rand -base64 32 | tr -d '/+=' | cut -c1-32`).
   - `ALLOWED_ORIGINS`: the exact public `https://` address.
   - `TRUST_PROXY=1` behind one reverse proxy (Caddy or nginx on the same machine).
3. The server refuses to start in production when an origin is not `https://` (except `http://localhost` for the local smoke test), when an origin has a path or trailing slash, or when `TRIVIA_FAST=1` is set. Tests: `apps/server/test/config.test.ts`.
4. Keep `HOST=127.0.0.1` so only the reverse proxy reaches Node, and keep PostgreSQL off the internet.

The Render and Neon steps below are an alternative to an own VPS.

One Render web service serves the web app, API and WebSocket from a single HTTPS origin. PostgreSQL runs on Neon.

Free-tier facts checked on 2026-11-07 (check again before you rely on them):
- Render Free web services spin down after 15 minutes without inbound HTTP or WebSocket traffic, and waking takes about a minute. Each workspace gets 750 free instance hours per month, which covers one always-on service. Render's free Postgres expires after 30 days, so we use Neon instead. Source: https://render.com/docs/free
- The Neon Free plan includes 100 CU-hours of compute and 1 GB of storage per project per month. Compute suspends after 5 minutes idle and resumes within a few hundred milliseconds. Source: https://neon.com/faqs/free-plan-limits-and-quotas

## 1. Database (Neon)
1. Create a project named `ghostel`. Pick a region close to the Render region (`oregon` in `render.yaml`, so AWS `us-west-2`).
2. Copy the connection string and make sure it ends with `?sslmode=require`.
3. Nothing else is needed. The server runs its migrations and seeds the house rooms on every start.

## 2. Web service (Render)
1. Push the repository to GitHub.
2. In Render: **New → Blueprint**, pick the repository. Render reads `render.yaml`.
3. Fill in the `sync: false` values:
   - `DATABASE_URL`: the Neon string from step 1.
   - `ALLOWED_ORIGINS`: the service URL, e.g. `https://ghostel.onrender.com`. If the name is taken, Render adds a suffix. Use the exact URL shown in the dashboard, without a trailing slash.
   - `VOICE_ICE_SERVERS`: leave it empty for now. Add a TURN server later if voice fails on some networks.
4. Deploy. The build runs `corepack enable && NODE_ENV=development pnpm install --frozen-lockfile && pnpm build`, and the start command is `pnpm start`. The health check uses `/api/health`.
   - If `corepack enable` fails on Render, change the build command to start with `npm install -g pnpm@11.1.3 &&`.
   - The install uses `NODE_ENV=development` because pnpm skips devDependencies (Vite, esbuild) under `NODE_ENV=production`.

## 3. Check the deployment
- `https://<your-app>/api/health` returns `{"ok":true}`.
- Check in, reload, and confirm the name and costume are kept.
- Open a second browser or phone and confirm you see each other.
- Create a password room, enter it from the other device, and try Pumpkin Trivia together.
- Join voice from two devices on **different networks** (for example a phone on mobile data and a laptop on Wi-Fi). If they never reach "1 connected", the network needs TURN. Add a TURN server to `VOICE_ICE_SERVERS` and redeploy.

## 4. Keep it awake during judging
1. In GitHub: **Settings → Secrets and variables → Actions → Variables**, add `GHOSTEL_URL` = `https://<your-app>`.
2. `.github/workflows/keep-alive.yml` pings `/api/health` every 10 minutes. GitHub may delay scheduled runs, so the first visit after a quiet period can still show Render's wake-up page. Ghostel's own "Waking the ghosts…" screen covers the rest.
3. Remove the variable after judging to save free hours.

## Local production check
`pnpm test:prod` builds and runs the server with `NODE_ENV=production` on http://localhost:2597. It checks the `__Host-` Secure cookie, the security headers, that the page loads without CSP errors, the cache headers and the SPA fallback.
