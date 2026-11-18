# Tasks — M24

- [x] 1. Reproduce with `e2e/context-loss.spec.ts` (fails before the fix: white screen, no recovery)
- [x] 2. `useContextGuard` and the recovering layer in `WorldScene`
- [x] 3. E2E: lost-and-not-restored and lost-and-restored both recover
- [x] 4. Typecheck, unit tests, build, the 3D E2E specs; docs

## Results (2026-11-18)
- **Before the fix** (`docs/evidence/test-e2e-context-loss-before-fix.txt`):
  - The middle of the screen went from mean luma 20 to **253**, white like the owner's screenshot.
  - The broken-image icon showed top left (`screenshots/desktop-context-lost.png` from that run).
  - Nothing recovered.
- **After** (`test-e2e-context-loss.txt`, pass):
  - The dark "Relighting the candles…" layer shows instead of white.
  - Never restored: a new canvas brings the scene back (luma 23, spread 36). The guest stays Live with no reload.
  - Restored by the browser: the same canvas comes back (luma 22, spread 34).
  - Screenshots: `desktop-context-lost.png` (now the layer) and `desktop-context-restored.png`.
- `pnpm build` and the web typecheck: exit 0.
- **Full E2E** (`test-e2e-m24.txt`): 29 of 31 passed. The load rose from 1.9 at the start to 29 at the end.
  - Two `rooms.spec.ts` tests failed: the door 3B prompt was not found, and the password room test timed out.
  - Re-run of `rooms.spec.ts` alone (`test-e2e-m24-rerun-rooms.txt`, load 3.5 → 98): the door 3B test passed, and the phone room test passed. The password room test timed out again, at the elevator clicks (`ride` to floor 2).
  - Neither trace contains the recovery layer, so the context guard did not fire in those runs.
  - This is the known load-related failure of this spec (see `HANDOFF.md`). It is still not a clean full pass.

## Not verified
- A real Android device. The owner should open the site, switch to another app for a while, come back, and check that the scene returns, briefly showing "Relighting the candles…".
