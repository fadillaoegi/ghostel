# Tasks — M18

- [x] 1. Measure the baseline (`scripts/measure-brightness.mjs`, `docs/evidence/brightness-before-m18.txt`)
- [x] 2. Exposure, fog and per-scene light values
- [x] 3. Re-take the screenshots, measure again (`docs/evidence/brightness-after-m18.txt`), look at them, adjust
- [x] 4. Full checks; docs (README, PROGRESS, HANDOFF, KIRO-ACTIVITY, ASSETS, specs index). Typecheck, unit, integration, build, full E2E (29 passed, 2026-11-11 09:33, started at load 2.9) and the production smoke test pass. Earlier full runs at load averages of 19–97 had 1 failure in `rooms.spec.ts` (door 2B walk).

## Changes found while building (differences from `design.md`)
- **No extra point lights.** The first version added a warm fill point light to the lobby and to every room. With them, the 2B room test slowed to its 90 s timeout. A trace showed a chat `Fill` taking 9.5 s and a key `Press` taking 20 s. Each extra light makes every lit material more expensive to draw, so both lights were removed. The rooms use more ambient and hemisphere light instead (1.6 and 1.2).
- **Lighter lobby floor texture.** After the first change the phone lobby screenshot was still as dark (8.0 → 8.2), because the phone camera looks mostly at the nearly black checker floor. The checker colours went from `#22163a` / `#140c22` to `#30214f` / `#1e1433`, and the phone lobby went to 27.0.
- **Lobby values:** ambient 1.15, hemisphere 1.3, directional 1.05, slightly higher than planned, to make up for the removed fill light.

## Result (middle of the screenshot, mean luma 0–255)
| Scene | Before | After |
| --- | --- | --- |
| Lobby (ghosts) | 14.2 | 20.4 |
| Lobby (two guests; the avatars stand in different places each run) | 25.4 | 23.9 |
| Floor 2 / 3 / 5 | 21.8 / 21.7 / 24.3 | 25.7 / 26.1 / 28.4 |
| Diner | 30.2 | 33.0 |
| Rooms (house, library, ballroom) | 8.7 / 10.3 / 10.5 | 15.1 / 17.7 / 16.4 |
| Phone lobby / phone room | 8.0 / 12.7 | 27.0 / 22.4 |

The screenshots were checked by eye. The scenes are still night-time and signs still glow, but the floors, tables and guests read more clearly.
