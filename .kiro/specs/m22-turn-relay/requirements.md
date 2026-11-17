# Requirements — Milestone 22: TURN relay so calls connect across networks

Written before the code, on 2026-11-15.

Owner report (2026-11-15, Indonesian, with a screenshot of https://ghostel.fldev.co.id): two guests sit at Table 4 in the Grand Lobby. The meeting view shows both, but the pill says "0 connected". The other guest's tile stays black and no sound comes through after unmuting.

## Findings
- The site is up behind Cloudflare: `/api/health` returns `{"ok":true}` and the WebSocket works (Live, 2 people, chat arrives). So signaling reaches both browsers.
- "0 connected" means no `RTCPeerConnection` reached `connected`. Media goes browser to browser, not through the server.
- Production has no `VOICE_ICE_SERVERS`, so browsers get only Google's public STUN server. STUN cannot connect peers behind symmetric NAT or carrier-grade NAT, which is common on mobile data. That needs a TURN relay. `docs/DEPLOY.md` and `HANDOFF.md` already listed this as untested.

## What
1. The server can hand out **short-lived TURN credentials** (the TURN REST API scheme that coturn supports with `use-auth-secret`):
   - `TURN_URLS` (comma-separated `turn:` / `turns:` URLs)
   - `TURN_SECRET` (shared with coturn)
   - `TURN_TTL_SECONDS` (default 6 hours)
   - `GET /api/voice` adds one TURN entry. Its username is `<expiry unix time>:ghostel` and its credential is `base64(HMAC-SHA1(secret, username))`. The response also carries `ttl`.
2. Only checked-in guests get credentials (the existing 401 stays). The username never contains the guest ID.
3. The browser re-fetches ICE servers when its copy is older than half the TTL, so a tab left open for a day still gets valid credentials for new calls.
4. Config checks:
   - `TURN_URLS` and `TURN_SECRET` must be set together.
   - Every URL must start with `turn:` or `turns:`.
   - In production the secret must be at least 32 characters.
   - The TTL is limited to 10 minutes … 24 hours.
5. A coturn config example for the VPS, safe by default:
   - Auth secret only, no static users.
   - It refuses relaying to private, loopback and link-local addresses, so the relay cannot reach the VPS's own services such as PostgreSQL.
   - Per-user and total quotas.
   - A fixed relay port range.
6. `docs/DEPLOY.md` gets a TURN section: the Cloudflare DNS record must be "DNS only" (Cloudflare's proxy does not carry TURN), the firewall ports, and how to check that TURN works.

## Constraints
- `VOICE_ICE_SERVERS` keeps working as before (for STUN, or for a hosted TURN provider).
- Secrets only in `.env`. `.env.production.example` gets placeholders.
- No change to who receives signaling (security rule for calls).

## Done when
- Unit and integration tests cover the config checks and the credentials (HMAC verified, expiry, 401 without a session).
- A real coturn in Docker accepts the server's credentials. A browser gathers a `relay` candidate with them, and a wrong secret gives none.
- Typecheck, tests and build pass. The owner deploys coturn and retests on two networks; this part is for him.
