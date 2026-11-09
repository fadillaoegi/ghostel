# Tasks — Milestone 8: Four floors, melodic music, candy hunt

- [x] 1. Shared: floors, layouts, zones, candies, crown rule, protocol, NPCs/talkers + unit tests (`floors.test.ts`, 9 new)
- [x] 2. Server: migration 003, candies in repo/session, crown gate, hub floors + collect + integration tests (`floors.test.ts`, 7 new)
  - Added a scene epoch on moves so a move sent before an elevator ride cannot be applied to the new floor.
- [x] 3. Web: elevator, three floor environments, candies, talkers, prompts, elevator panel, HUD counter, crown lock in creator
  - Screenshot review: the floor 2 elevator and mirror sat on side walls and were seen edge-on, and the hall was too dark. Both moved to the north wall and the lighting went up.
  - Flaky E2E (prompt missing after arriving, 2 of 4 runs): the new scene's first frame could run before the effect that reads the server-given position, and sent a move from a guessed spawn point. The position is now read during render, and moves wait until the scene is placed. 6 of 6 repeated runs passed.
- [x] 4. Web: melodic music engine (`ui/music.ts`) + original scores (`ui/scores.ts`) + web unit tests (`apps/web/test/scores.test.ts`, 7); `ambience.ts` removed
- [x] 5. E2E (`e2e/floors.spec.ts`: elevator through 4 floors, floor chat isolation, runway candy, mirror prompt opens the creator with a locked crown, lobby candy persists across reload, phone floors) + screenshots
- [x] 6. Category report (`docs/CATEGORY-REPORT.md`)
- [x] 7. Evidence and docs
