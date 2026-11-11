# Tasks — M17

- [x] 1. Steering: `product.md` (decision, milestone 8 note, category plan), `submission.md` ("Also inside" list)
- [x] 2. Shared: `games/pairs.ts` engine, registry and `GameView`, `ROOM_GAMES`, host lines; unit tests
- [x] 3. Server: config, registry wiring, migration `006_monster_pairs`, house room 1B; integration tests (hub untouched)
- [x] 4. Web: `GameParts.tsx` (shared podium and timer), `PairsPanel.tsx` and CSS, Lobby and room form wiring
- [x] 5. E2E `e2e/pairs.spec.ts` with screenshots; review the screenshots
- [x] 6. `docs/GAME-KIT.md`
- [x] 7. Run typecheck, unit, integration, build, E2E, production smoke test; store real output in `docs/evidence/`
- [x] 8. Docs: README, PROGRESS, HANDOFF, KIRO-ACTIVITY, ASSETS, specs index, category report

## Changes found while building
- `removePlayer` gets no clock from the kit, so it cannot start the next turn's timer. It only marks the player gone, and the next `advance` hands the turn over.
- `GameView` became a union. The server's Trivia tests narrow it with a small `trivia()` helper.
- The migration test in `doors.test.ts` builds a pre-006 schema, so it seeds house room 1B with its old game (Trivia).
- The first server game test let both players flip the same two cards forever. The test players now remember faces, like real players would.
- The first phone E2E test created a Monster Pairs room. That took a door and broke the door expectations in `rooms.spec.ts` later in the full run. It now plays in house room 1B and only checks that the form offers the game.
- One full E2E run on a heavily loaded machine (load average about 20) failed two walking tests in `rooms.spec.ts`. The walks timed out before reaching a door. Those specs passed alone, and the next full run passed 29 of 29. The failed output is kept in `docs/evidence/test-e2e-failed-under-load-2026-11-10.txt`.
