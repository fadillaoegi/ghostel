# Design — Milestone 13

> **Written after implementation.** This spec was written after the code was built (2026-11-09), not before it as the workflow requires. See `docs/KIRO-ACTIVITY.md`, session 3.

Implemented inside `CallClient` (`toggleCam`), `media` message `cam` stream id, `Tile` with `StreamVideo`. No server changes beyond M12 (the server only relays the stream id inside the call).

## Testing
`e2e/voice.spec.ts`: Chromium's fake camera; the other browser's tile shows `data-cam="on"` and a video with a non-zero width; after leaving the room no video elements remain.

Follow-up (2026-11-09, owner report "the camera looks squashed during a presentation"): meeting tiles are always 4:3 (`aspect-ratio`), and under a presentation they form a strip of fixed 160 px tiles (120 px on phones). `e2e/present.spec.ts` checks the ratio of every tile.
