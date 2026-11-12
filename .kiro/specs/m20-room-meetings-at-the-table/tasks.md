# Tasks — M20

- [x] 1. Steering: `product.md`, `security.md`, `architecture.md`; superseded notes in the M12 and M14 specs
- [x] 2. Hub: call key, meeting checks, presentation delivery and checks, slides
- [x] 3. Server tests: room calls and presentations with seated guests, plus the standing cases
- [x] 4. Web: no call bar or floating stage for standing guests, the hint, requests only when seated
- [x] 5. E2E: voice and present specs sit first; folded meeting keeps the screen share live
- [x] 6. Full checks with evidence; docs

## Changes found while building
- The meeting view had no "connected" count, which was in the removed call bar. It now shows "🎙️/🔇 N connected" in its header (`data-testid="voice-status"`). This is useful for guests, and the voice E2E test still checks real peer connections.
- `CallBar` and the floating presentation panel had no users left, so they and their CSS were removed. So was `CallControls`' `compact` prop. The screenshot `desktop-present-minimized.png` showed the removed panel, so it was deleted and replaced by `desktop-present-folded.png` (the folded meeting with its live mini stage). The new `desktop-room-standing.png` shows the hint.
- A shared `ROOM_TABLE_ID` ("long") now names every room's long table in `tables.ts` and the hub.

## Check runs (2026-11-12)
- Typecheck, 136 + 8 unit tests, 91 integration tests (calls 7, presentations 5 including the new standing case), build and the production smoke test: all exit 0.
- **E2E run 1** (`test-e2e-invalid-overlapping-build-2026-11-12.txt`): 26 passed, 3 failed. Not valid: Kiro started `pnpm test:server` and `pnpm build` while this run was going, and `pnpm build` rewrote `apps/web/dist` and `apps/server/dist` under the running test server.
- **E2E run 2** (`test-e2e-failed-under-load-2026-11-12b.txt`): 26 passed, 3 failed (`present.spec.ts` PDF, two `rooms.spec.ts` walks). Started at load 2.5; the load rose to 39 during the run (macOS `StorageManagementService` about 50% CPU).
- **Re-run of `present.spec.ts` and `rooms.spec.ts`** (`test-e2e-rerun-present-rooms.txt`): 5 passed, exit 0.
- `voice.spec.ts`: 3 passed in the targeted run. Its Diner test failed once in the first targeted run and passed in the next 2 runs.
- In total, every spec passed in at least one run, but no single full run passed after M20. `docs/evidence/test-e2e.txt` holds the last full run as it happened (3 failed).
