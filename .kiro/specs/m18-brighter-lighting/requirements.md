# Requirements — Milestone 18: brighter lighting

Written before the code, on 2026-11-10.

Owner request (2026-11-10, Indonesian): "make Ghostel's lighting a little brighter, it is too dark".

## Baseline (measured, `docs/evidence/brightness-before-m18.txt`)
Mean luma (0–255) of the middle 60% × 50% of the E2E screenshots, mostly the 3D scene:

| Scene | Middle |
| --- | --- |
| Rooms (house room, library, ballroom) | 8.7, 10.3, 10.5 |
| Lobby (ghosts, two guests) | 14.2, 25.4 |
| Floors 2, 3, 5 | 21.8, 21.7, 24.3 |
| Ghoul's Diner (floor 4) | 30.2 |
| Phone lobby, phone room | 8.0, 12.7 |

## Acceptance criteria
- Every scene is brighter. Rooms and the lobby gain the most, so they come close to the Diner, which the owner has not called dark.
- It still reads as a haunted hotel at night: dark background, glowing signs and candles, no flat grey look. Lit signs and emissive props must not wash out.
- The visual-style rules stay: ambient, hemisphere and one directional light per scene, a few point lights, no flashing.
- The same screenshots are measured again after the change (`docs/evidence/brightness-after-m18.txt`) and checked by eye.
- No change to gameplay. All existing tests still pass.
