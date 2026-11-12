# Tasks — M19

- [x] 1. Probe (`scripts/perf-probe.mjs`) and baseline (`docs/evidence/perf-before-m19.txt`)
- [x] 2. Adaptive pixel ratio; measure
- [x] 3. Fewer lobby point lights; measure
- [x] 4. Merge the lobby's static windows and pillars; measure
- [x] 5. Screenshots checked by eye; full checks; `perf-after-m19.txt`; docs

## Measured after each step (retina, lobby)
| Step | Lobby fps | p95 frame | Draws/frame | Canvas |
| --- | --- | --- | --- | --- |
| Before | 35.0 | 50 ms | 450 | 2390×1435 |
| 1. Pixel ratio max 1.5 + PerformanceMonitor | 39.2 | 50 ms | 443 | 2049×1230 |
| 2. Lobby point lights 8 → 5 | 55.8 | 33 ms | 448 | 2049×1230 |
| 3. Windows and pillars merged | 57.7 | 16.8 ms | 396 | 2049×1230 |
| Final run (`perf-after-m19.txt`, load 1.8) | 57.0 | 16.8 ms | 397 | 2049×1230 |

The other scenes went from 44–56 fps to 58–60 fps on Retina.

## Changes found while building
- The step that helped the lobby most was removing point lights (39 → 56 fps), not the pixel ratio. This matches M18, where two extra point lights slowed the browser tests.
- Merging saved 54 draws per frame (−12%), fewer than the 63 counted from the parts. The rest of the 400 draws come from avatars, tables, candles, pumpkins, doors and decor. A further step could merge or instance those.
- Some full E2E and probe runs on 2026-11-12 failed at load averages of 21–171. That day `airportd` (the Wi-Fi daemon) used about 118% CPU, alongside macOS storage scanning. The failed run is kept in `docs/evidence/test-e2e-failed-under-load-2026-11-12.txt`. The re-run started at load 2.5 passed 29 of 29.
