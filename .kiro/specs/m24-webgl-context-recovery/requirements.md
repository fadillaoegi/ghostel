# Requirements — Milestone 24: recover the 3D view after the WebGL context is lost

Written before the fix, on 2026-11-18, after reproducing the bug.

Owner report (2026-11-18, Indonesian, screenshot from Android Chrome on https://ghostel.fldev.co.id, seated at Table 4 with "1 connected"): the screen suddenly went blank white. The HUD, name tags, joystick and meeting bar still worked. A small broken-image icon showed in the top-left corner.

## Cause (reproduced)
- `e2e/context-loss.spec.ts` loses the 3D canvas's WebGL context with `WEBGL_lose_context`. The middle of the screen goes from a mean luma of 20 (the dark scene) to 253 (white). Everything else keeps working, and the same broken-image icon appears top left. Evidence: `docs/evidence/test-e2e-context-loss-before-fix.txt`, `screenshots/desktop-context-lost.png`.
- Android Chrome loses WebGL contexts when the app goes to the background, under memory pressure (a call with video decoding adds to it), or when its GPU process restarts. The browser does not always restore them.
- Ghostel never listened for `webglcontextlost`, so nothing brought the view back. Only a reload did.

## What
1. When the context is lost, a dark "Relighting the candles…" layer covers the 3D view at once, instead of white.
2. If the browser restores the context within 2 seconds, three.js re-creates its GPU resources and the layer disappears.
3. Otherwise the 3D canvas is mounted again with a new WebGL context. The guest stays checked in, connected and seated: no page reload, and the call keeps running.
4. When the tab becomes visible again with a lost context, recovery starts at once.
5. After 3 failed attempts within a minute, the layer offers a "Reload" button instead of retrying forever.

## Done when
- The E2E test passes in both cases: lost and never restored (new canvas), and lost then restored (same canvas). The scene's brightness comes back close to the value before.
- Typecheck, unit tests and build pass. The existing E2E specs that use the 3D view still pass.
