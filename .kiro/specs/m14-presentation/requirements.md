# Requirements — Milestone 14: presentations in rooms

> **Written after implementation.** This spec was written after the code was built (2026-11-09), not before it as the workflow requires. The approval rule (owner approves) was agreed with the owner before coding. See `docs/KIRO-ACTIVITY.md`, session 3.

Owner request (2026-11-08): "a presentation feature like Zoom"; do both screen sharing and PDF slides; everyone can present with the approval of the room's owner.

## Acceptance criteria
- In a room, the owner presents directly; other guests "Ask to present" and the owner sees the request with Allow / Not now.
- One presenter per room. The owner can stop any presentation; the presenter can stop their own.
- Screen share: after approval the presenter clicks "Share your screen" (desktop browsers). The server announces a screen stream only for the approved screen presenter.
- PDF slides: after approval the presenter picks a PDF (≤ 10 MB). The server checks the presenter, the size and the `%PDF-` signature, keeps the file in memory only and serves it only to guests inside the room. The presenter turns pages for everyone.
- The presentation shows on the meeting stage when seated, in a floating panel otherwise, and on a big screen on the room's north wall.
- When the presenter leaves the room (or the room empties or is deleted), the presentation ends and the slides are deleted.
