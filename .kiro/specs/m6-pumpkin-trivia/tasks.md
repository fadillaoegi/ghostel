# Tasks — Milestone 6: Pumpkin Trivia

- [x] 1. Shared: game engine interface + registry (`games/engine.ts`, `games/index.ts`), trivia engine (`games/trivia.ts`), 36-question bank, protocol, unit tests (13 new)
- [x] 2. Server: game hosting in the hub (start, actions, 200 ms timer, per-viewer views, leave), `Config.trivia` with `TRIVIA_FAST=1` for E2E
- [x] 3. Server integration tests (6 new)
- [x] 4. Web: presence game state, `TriviaPanel`, synthesized `sfx`, HUD start button, final results card with Play again
  - Found in screenshots: the reveal animation faded the correct answer in from opacity 0, so for a moment it looked missing; the panel was also too transparent over the bright ballroom. The correct answer now only scales, and the panel background is nearly opaque.
- [x] 5. E2E (solo vs bot to the podium + Play again; desktop and phone players share a question and see picks after the reveal) + screenshots
- [x] 6. Evidence and docs
