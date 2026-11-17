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

## Own VPS (`compose.vps.yaml`)
The VPS also runs other apps on ports 8100–8107 and its Docker bridge network is broken, so Ghostel uses the host network like they do:

| Port | Service | Reachable from |
|---|---|---|
| 8108 | Node server (`app`): web build, API, WebSocket | 127.0.0.1 only |
| 8109 | nginx (`web`, `deploy/nginx.conf`): public entry, proxies everything to 8108 | all interfaces (Cloudflare Tunnel) |
| 8100 | the existing PostgreSQL 18 server: own role `ghostel`, databases `ghostel` and `ghostel_test` | 127.0.0.1 |

1. `cp compose.vps.example.yaml compose.vps.yaml` and `cp deploy/nginx.conf.example deploy/nginx.conf` (both are git-ignored, so per-machine changes never conflict on `git pull`). Then `cp .env.vps.example .env.vps`, `chmod 600 .env.vps`, then fill in `POSTGRES_PASSWORD` (the `ghostel` role password) and `ALLOWED_ORIGINS` (the exact public `https://` hostname).
2. `docker compose -f compose.vps.yaml --env-file .env.vps up -d --build`
3. In Cloudflare Tunnel, point the public hostname to `http://localhost:8109`.
4. nginx takes the visitor's address from `CF-Connecting-IP` only when the connection comes from 127.0.0.1 (a tunnel connector on this machine). If the connector runs elsewhere, every visitor shares one rate-limit bucket; add its address to `set_real_ip_from`.
5. nginx forwards the WebSocket upgrade and keeps idle connections open for up to 1 hour.

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
- Join voice from two devices on **different networks** (for example a phone on mobile data and a laptop on Wi-Fi). If they never reach "1 connected", the network needs TURN: see "TURN relay" below.

## TURN relay for calls (own VPS, M22)
Calls are peer-to-peer. With only STUN, two guests on different networks often cannot reach each other: mobile data in particular uses carrier-grade NAT. The meeting then shows "0 connected", the other tile stays black and there is no sound. A TURN relay forwards the media when a direct path fails.

1. **DNS:** add an `A` record `turn.<your-domain>` → the VPS's public IP. In Cloudflare set it to **DNS only** (grey cloud). Cloudflare's proxy only carries HTTP and WebSocket, not TURN. The app's own record can stay proxied.
2. **Firewall** on the VPS (and in the provider's panel, if it has one): open `3478/udp`, `3478/tcp` and `49160-49200/udp`. Also open `5349/tcp` if you enable TLS.
3. **Secret:** `openssl rand -hex 32`. Put it in Ghostel's `.env` as `TURN_SECRET`, and in `turnserver.conf` as `static-auth-secret`.
4. **coturn:**
   ```sh
   cd deploy/coturn
   cp turnserver.conf.example turnserver.conf
   # fill in static-auth-secret and realm (turn.<your-domain>), and external-ip if the VPS has a private address
   chmod 600 turnserver.conf
   docker compose up -d
   docker compose logs | grep -i -E "error|bad config"   # should print nothing
   ```
   The example refuses to relay to private, loopback, CGNAT and link-local addresses, so the relay cannot reach PostgreSQL or the Ghostel server on the VPS. It also has bandwidth quotas.
5. **Ghostel `.env`:**
   ```sh
   VOICE_ICE_SERVERS=[{"urls":"stun:turn.<your-domain>:3478"}]
   TURN_URLS=turn:turn.<your-domain>:3478?transport=udp,turn:turn.<your-domain>:3478?transport=tcp
   TURN_SECRET=<the same secret>
   ```
   Restart the Ghostel server. It refuses to start if only one of `TURN_URLS`/`TURN_SECRET` is set, if a URL is not `turn:`/`turns:`, or if the secret is shorter than 32 characters.
6. **Check:**
   - From your laptop: `TURN_URLS=turn:turn.<your-domain>:3478?transport=udp TURN_SECRET=<secret> apps/server/node_modules/.bin/tsx scripts/turn-probe.ts`. It must print a `relay` candidate with the right secret, none with a wrong one, and `RESULT: OK`. Add `--connect` to also send data through the relay.
   - Then test a call between a phone on mobile data and a laptop on Wi-Fi. Both should reach "1 connected".
7. **Optional, TLS (`turns:` on 5349):** helps on networks that block everything except HTTPS-like traffic. Get a certificate for `turn.<your-domain>` (for example certbot with a DNS challenge), uncomment the `tls-listening-port`, `cert` and `pkey` lines, mount the certificate folder in `docker-compose.yml`, and add `turns:turn.<your-domain>:5349` to `TURN_URLS`.

Bandwidth: a relayed call with camera uses about 1–2 Mbit/s per person in each direction. Only calls that cannot connect directly use the relay.

## 4. Keep it awake during judging
1. In GitHub: **Settings → Secrets and variables → Actions → Variables**, add `GHOSTEL_URL` = `https://<your-app>`.
2. `.github/workflows/keep-alive.yml` pings `/api/health` every 10 minutes. GitHub may delay scheduled runs, so the first visit after a quiet period can still show Render's wake-up page. Ghostel's own "Waking the ghosts…" screen covers the rest.
3. Remove the variable after judging to save free hours.

## Local production check
`pnpm test:prod` builds and runs the server with `NODE_ENV=production` on http://localhost:2597. It checks the `__Host-` Secure cookie, the security headers, that the page loads without CSP errors, the cache headers and the SPA fallback.
