> **Superseded in part by M20 (2026-11-12):** a room's call and its presentations now belong to the guests seated at its long table, not to everyone inside the room. See `.kiro/specs/m20-room-meetings-at-the-table/`.

# Requirements — Milestone 12: seats, table calls and the meeting view

> **Written after implementation.** This spec was written after the code was built (2026-11-08/09), not before it as the workflow requires. The decisions in it were agreed with the owner in chat before coding. See `docs/KIRO-ACTIVITY.md`, session 3.

Owner request (2026-11-08, Indonesian, summarised): every floor gets tables for 2 and 4; sitting at a table lets you talk right away with whoever sits there; when seated the screen looks like a Zoom meeting; every room gets a long table with as many seats as the member count chosen when the room is created. Confirmed answers: room size 2–8; microphone and camera off until the user turns them on; in a room everyone shares one call and sitting only opens the meeting view, on a floor only the guests at that table are connected.

## Acceptance criteria
- Tables for 2 and 4 on floors 1, 2, 3 and 5 and many in the Diner (floor 4). Every chair has a prompt; E / tap / A sits down; E, walking, "Stand up" or gamepad B stands up.
- The server seats a guest only on a free chair of a table in the guest's scene, within 2.4 of the server's position for them; one seat per connection; moves are ignored while seated; standing puts the guest just outside the chair; scene changes and disconnects free the seat.
- A table call contains exactly the guests seated at that table; a room call contains everyone inside the room. Signaling, media state and member lists reach only that call's members.
- Microphone access is requested only from a click; nobody is unmuted by default.
- The meeting view lists one tile per call member with name, mic state, speaking glow and costume badge (or camera, M13), and can be folded to see the hotel. Phones: full screen, chat button inside.
- Rooms: capacity 2–8 at creation (default 8, cannot change), enforced at entry ("This room is full (N guests)."); the long table has that many chairs.
