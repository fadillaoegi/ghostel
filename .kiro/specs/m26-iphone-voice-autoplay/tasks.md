# Tasks — M26

- [x] 1. Diagnose: production bundle, headers, the iPhone autoplay rule
- [x] 2. Retry refused remote voices on the next gesture; listen to the touch-end events too
- [x] 3. E2E for calls and phones; typecheck; unit tests; docs
- [ ] 4. Owner: real iPhone check (listen without unmuting, after one tap)

## What happened (`docs/evidence/test-e2e-ios-audio-prime.txt`, every run kept)
1. **First attempt:** `prime()` called `play()` on every voice element that was `paused` with a `srcObject`, on every gesture.
   - `voice.spec` and `present.spec` then failed in 4 runs in a row: the room meeting and the screen share test timed out, and the camera tile stayed "off" in one run.
   - The load also climbed to 33–61 during those runs. Kiro first suspected the load.
2. **A/B control:** with the change removed and rebuilt, the same specs passed 4 of 4 (load 4.8 → 33). So the change was the cause, not only the load.
3. **Bisect:** only the new gesture events (`pointerup`, `touchend`, `click`) passed 4 of 4. So the cause was the broad `play()` retry.
   - The exact mechanism was not proven. The likely one is that `play()` was called again and again on every click, on elements that were paused for other reasons.
4. **Final fix (v2):** remember only elements whose `play()` was refused, and retry just those. That passed 4 of 4.
5. **Confirmation run with `mobile.spec`:** 6 of 7 passed. The Diner table test failed while walking to a chair (`holdUntilSeat`, before any call or voice element existed), with the load rising to 46. The same test passed in the run before with the same code.
6. `pnpm test:unit`: 138 + 12 pass. `pnpm typecheck`: exit 0.

## Not verified
- A real iPhone. Chromium in the tests allows autoplay, so the "refused" path itself never ran in a test.
