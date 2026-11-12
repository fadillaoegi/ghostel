# Design — M19

## 1. Adaptive pixel ratio (`WorldScene.tsx`)
- The pixel ratio starts at `min(devicePixelRatio, 1.5)` instead of the 1.75 cap.
- drei `PerformanceMonitor` lowers it in steps to 1.0 when the frame rate falls (`onDecline`) and raises it again up to 1.5 when there is headroom (`onIncline`). `flipflops` limits how often it may switch before it settles. The value is held in state on `Canvas`'s `dpr`.
- Text and name tags are DOM elements, so they stay sharp. Only the 3D image gets slightly softer on Retina.

## 2. Fewer point lights in the lobby (`Decor.tsx`, `NightDesk.tsx`)
- The two far corner pumpkins near the north wall stop casting light. They keep their emissive face, so they still glow. The two pumpkins at the front doors, which are near the camera, keep their light.
- The Night Desk's green point light is removed. Its screen is `meshBasicMaterial` and glows by itself.
- The lobby goes from 8 point lights to 5: the hall, the fountain, the porch and 2 pumpkins.

## 3. Merged static meshes (`three/merge.ts`, `LobbyHall.tsx`)
- `useMergedParts(parts)` takes a list of `{ geometry, position, rotation, scale?, material key }` parts. It bakes each transform into a clone of the geometry and merges the clones per material with `mergeGeometries` from `three/examples/jsm/utils/BufferGeometryUtils.js`. It returns one mesh per material. The geometries are disposed on unmount.
- The arched windows (8) and the pillars (6) are built from parts this way: 140 meshes become one mesh per material.
- The pillar lanterns flicker (animated light colour). Pillars keep the lantern as its own mesh only if it animates; otherwise it is merged too.
- Obstacles do not change: the pillars stay obstacles in `layout.ts`.

## Check
- Run `scripts/perf-probe.mjs 2 5` and `1 5` after each step, and keep the final numbers in `docs/evidence/perf-after-m19.txt`.
- Re-take the lobby screenshots and look at them.
- Run the full checks.
