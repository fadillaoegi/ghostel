# Tasks — M22

- [x] 1. Steering: TURN rule in `security.md`
- [x] 2. Config: `TURN_URLS`, `TURN_SECRET`, `TURN_TTL_SECONDS` with checks; tests
- [x] 3. `/api/voice`: short-lived TURN credentials and `ttl`; integration test
- [x] 4. Browser: re-fetch ICE servers after half the TTL
- [x] 5. coturn example config and compose file; `.env.production.example`; `docs/DEPLOY.md` TURN section
- [x] 6. Local proof: coturn in Docker, `scripts/turn-probe.ts` gets a relay candidate with real credentials and none with a wrong secret
- [x] 7. Typecheck, unit, integration, build; docs (PROGRESS, HANDOFF, KIRO-ACTIVITY, specs index, README)
- [ ] 8. Owner: deploy coturn on the VPS, set the `.env`, run `turn-probe.ts` against `turn.fldev.co.id`, test a call between mobile data and Wi-Fi

## Results (2026-11-16)
- `pnpm test`: exit 0. Integration: 13 files, **100** tests, including the new `turn.test.ts` (2 tests) and 3 new tests in `config.test.ts` (`docs/evidence/test-m22.txt`).
- `pnpm typecheck`: exit 0 (`typecheck-m22.txt`). **Correction (2026-11-17):** that run did *not* cover `scripts/turn-probe.ts`. Kiro wrote the new `tsconfig.json` and started the typecheck in the same parallel batch, and the file's modification time (16:59:43) is after the typecheck (16:56:58). The first real run with the probe included (M23) failed: the probe imported `voice.ts`, which pulls in Fastify types without `@fastify/cookie`'s augmentation. Fixed by moving `turnCredentials` into `apps/server/src/http/turn.ts` (no Fastify). See `typecheck-m23.txt`. `pnpm build`: exit 0 (`build-m22.txt`).
- `docs/evidence/turn-probe.txt`, against `coturn/coturn:4.7` (4.7.0-r4) in Docker on this Mac:
  - Right secret: one `relay` candidate. Wrong secret: none, and coturn logged "Cannot find credentials of user". This happened in every run.
  - Run 5: one relay-only peer and one unrestricted peer exchanged a data-channel message through the relay (`prflx -> relay`, `connected/connected`).
  - The real `turnserver.conf.example` (with all `denied-peer-ip` lines) starts without config warnings, and the credential check passes with it.

## Changes found while building
- coturn 4.7 no longer accepts `no-tlsv1` and `no-tlsv1_1` ("Bad configuration format"). They were removed from the example, since old TLS versions are already off by default.
- The probe had two bugs of its own: it trickled candidates too early (run 1), and tsx's `__name` helper was missing inside `page.evaluate` (run 2). Both are fixed and recorded in the evidence file.
- Two relay-only peers on one Mac did not connect through Docker Desktop's port mapping (runs 3–4, with no coturn error). It looks like Docker Desktop does not hairpin UDP back into the container. On the VPS, coturn uses host networking, so this case does not arise there. It was **not** verified on a VPS.

## Not verified
- The relay-to-private-address block (`denied-peer-ip`) was only checked for config syntax, not by trying to relay to a private address.
- Anything on the owner's VPS: DNS, firewall, `external-ip`, and a real call between mobile data and Wi-Fi.
