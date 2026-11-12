# Requirements — Milestone 19: smoother frame rate

Written before the code, on 2026-11-12.

Owner request (2026-11-12, Indonesian): "the app lags a bit, can you make it smoother?"

## Baseline (measured, `docs/evidence/perf-before-m19.txt`, `scripts/perf-probe.mjs`)
Measured with Chromium (Metal) on the owner's Apple M1, viewport 1366×820, 5 s per scene, one guest.

| Scene | Retina (device scale 2): fps / p95 frame | Scale 1: fps | Main-thread script time | Draw calls per frame |
| --- | --- | --- | --- | --- |
| Lobby | **35.0 / 50 ms** | 60 | **267–355 ms/s** | **450** |
| Floor 2 | 50.8 / 33 ms | 60 | 90–101 ms/s | 117 |
| Floor 3 | 44.0 / 33 ms | 60 | 82–110 ms/s | 121 |
| Floor 4 | 55.4 / 33 ms | 60 | 72–78 ms/s | 72 |
| Floor 5 | 53.2 / 33 ms | 60 | 78–80 ms/s | 134 |
| Room 1A | 55.6 / 33 ms | 60 | 88–108 ms/s | 132 |

Findings:
1. **Pixels:** on a Retina screen the canvas is 2390×1435 (dpr capped at 1.75), about 3.1 times the pixels at scale 1. Every scene runs at 60 fps at scale 1, so the GPU's per-pixel work is the main cost on Retina.
2. **Lights:** every lit pixel pays for every point light. The lobby has 8: the hall, the fountain, the porch, 4 lit pumpkins and the Night Desk. In M18, adding two more point lights visibly slowed the browser tests.
3. **Draw calls:** the lobby draws 450 objects per frame against 72–134 on other floors. The JS profile is mostly three.js per-object work (`renderBufferDirect`, uniform uploads, matrix updates). The 8 arched windows (10 meshes each) and the 6 pillars (10 meshes each) alone are about 140 draws.
4. React does not re-render on movement snapshots (positions are mutated in place), so that is not the cause.

## Acceptance criteria
- On Retina, the lobby reaches at least 50 fps in the probe, and no scene gets slower.
- On weaker devices the pixel ratio drops by itself when the frame rate falls, and rises again when there is headroom.
- The lobby draws clearly fewer objects per frame, and its main-thread script time drops.
- It looks the same, apart from at most one or two less important glows (for example the corner pumpkins keep their emissive glow but lose their point light). Screenshots are checked by eye.
- All tests pass. The probe is re-run after the change (`docs/evidence/perf-after-m19.txt`).
