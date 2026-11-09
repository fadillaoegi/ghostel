# Design — Milestone 14

> **Written after implementation.** This spec was written after the code was built (2026-11-09), not before it as the workflow requires. The approval rule (owner approves) was agreed with the owner before coding. See `docs/KIRO-ACTIVITY.md`, session 3.

- Shared `calls.ts`: `PresentMode`, `PresentationView`, `PresentRequest`, `SLIDES_MAX_BYTES`. Protocol: `present_request`, `present_decide`, `present_stop`, `present_page`; server `presentation`, `present_requests`.
- Hub: presentations and requests per room channel, owner checks, `mayShareScreen`, `acceptSlides`, `slidesFor`, cleanup in `leaveChannel`.
- HTTP `apps/server/src/http/slides.ts`: `POST /api/rooms/:id/slides` (raw body, Origin checked by the global hook, per-guest rate limit) and `GET /api/rooms/:id/slides/:token` (`application/pdf`, attachment, `no-store`, `nosniff`, `CSP: sandbox`).
- Web `ui/Presentation.tsx`: `PresentControls`, `PresentRequests`, `Stage` (screen video or pdf.js canvas); pdf.js 6.5.438 loaded lazily with `enableXfa: false`, `useWasm: false` and standard fonts served from `/pdfjs/standard_fonts/` (copied at build by a Vite plugin). `RoomScreen` in the room interior copies the stage element into a texture.

## Testing
Server `presentations.test.ts`: request/approve/refuse/stop rules, screen id only for the approved presenter, upload checks (403, 415, 413), download only from inside the room, page turns, cleanup when the presenter leaves, Origin check. E2E `present.spec.ts`: PDF slides with approval and page turns seen by the owner; owner screen share seen live by a guest.

Follow-up (2026-11-09, owner request "it should still be minimizable so users can watch it on the TV"): the floating panel minimizes to a corner thumbnail and the folded meeting view keeps a small stage. The stage is never unmounted while a presentation runs, because the room's TV texture copies its `<video>` or `<canvas>`. Tested in `e2e/present.spec.ts` (video keeps playing while minimized).
