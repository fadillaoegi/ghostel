# Design — M22

## Server
- `apps/server/src/config.ts`: `turn: TurnConfig | null`, where `TurnConfig = { urls: string[]; secret: string; ttlSeconds: number }`. It is parsed by `parseTurn(env, production)` and refuses invalid input at startup, like the existing production checks.
- `apps/server/src/http/voice.ts`: `turnCredentials(turn, nowMs)` returns `{ urls, username, credential }`. `username = "<floor(now/1000) + ttl>:ghostel"`, `credential = createHmac("sha1", secret).update(username).digest("base64")`. The route returns `{ iceServers: [...static, turnEntry], ttl }` with `Cache-Control: no-store`. Without TURN, the response stays `{ iceServers }`, as before.
- The guest ID is not part of the username. coturn only checks the HMAC and the expiry.

## Browser
- `CallClient` keeps `iceFetchedAt` and `iceTtl`. It re-fetches when `now - iceFetchedAt > iceTtl / 2`. Existing peer connections keep their allocation; only new peers use the new list.

## VPS (coturn)
- `deploy/coturn/turnserver.conf.example`:
  - `listening-port=3478`, `fingerprint`, `use-auth-secret`, `static-auth-secret`, `realm`
  - relay ports `49160-49200`, `no-cli`, `no-multicast-peers`
  - `denied-peer-ip` for every private, loopback, CGNAT and link-local range
  - `user-quota` and `total-quota`, `log-file=stdout`
  - `external-ip` for VPSs behind 1:1 NAT
- `deploy/coturn/docker-compose.yml`: `coturn/coturn` with `network_mode: host` (a relay port range through Docker's port mapping is slow and error-prone), the config mounted read-only, `restart: unless-stopped`.

## Verification
- `apps/server/test/config.test.ts`: the TURN parsing rules.
- `apps/server/test/calls.test.ts`: `/api/voice` with TURN. The HMAC is recomputed in the test, the expiry is checked against the TTL, and the response has no guest ID.
- `scripts/turn-probe.mjs`: starts nothing itself. Against a running coturn and a running server, it checks in a guest, reads `/api/voice`, then uses headless Chromium with `iceTransportPolicy: "relay"` and reports the candidate types. A relay candidate appears only if coturn accepted the credentials. Run locally against coturn in Docker with the dev server, and stored in `docs/evidence/`.
