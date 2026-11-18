# Tasks — M23

- [x] 1. Steering: `product.md` (15 shown, scroll, daily reset at 00:00 WIB), `security.md` (paging only within one's own channel)
- [x] 2. Shared: constants, `chatDay`, protocol messages; unit tests
- [x] 3. Server: welcome page, `chat_older`, daily reset with timer; integration tests
- [x] 4. Web: client paging and reset, panel with visible count, scroll keeping, "Earlier messages"; web unit test
- [x] 5. E2E: existing chat spec plus loading earlier messages
- [x] 6. Typecheck, tests, build; evidence; docs

## Results (2026-11-18, load average about 2)
- `pnpm typecheck`: exit 0 (`docs/evidence/typecheck-m23.txt`).
- `pnpm test`: exit 0. Unit tests: 138 shared and 12 web (`chatView.test.ts` is new). Integration: 14 files, **103** tests (`chat-paging.test.ts` is new, with 3 tests) (`test-m23.txt`).
- `pnpm build`: exit 0 (`build-m23.txt`).
- `e2e/chat.spec.ts`: 4 of 4 pass (`test-e2e-chat-m23.txt`). The new test:
  - Four API-only guests write 20 messages. A reader who checks in sees exactly 15.
  - Scrolling to the top loaded the older ones. The log was scrollable, so the scroll path ran, not the button.
  - The old top message stayed in view.
  - Clicking "Earlier messages" until the start of the day removes the button.
  - Sending a message brings the panel back to 15.
- Screenshot: `docs/evidence/screenshots/desktop-chat-15.png`.

## Notes
- The daily reset is tested at the integration level with an injected clock (23:59 → 00:01 WIB). The E2E server uses the real clock, so it cannot cross midnight on demand.
- The reset time is a constant, `CHAT_DAY_UTC_OFFSET_HOURS = 7` (WIB). If the owner wants another time zone, it is one number in `packages/shared/src/chat.ts`.
- The full E2E suite was not run for M23. Only `chat.spec.ts` ran.
