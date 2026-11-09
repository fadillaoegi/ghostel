# Design — Milestone 12

> **Written after implementation.** This spec was written after the code was built (2026-11-08/09), not before it as the workflow requires. The decisions in it were agreed with the owner in chat before coding. See `docs/KIRO-ACTIVITY.md`, session 3.

## Shared
- `tables.ts`: `roundTable`, `longTable(capacity)`, `roomTable` (cached), `FLOOR_TABLES`, `tablesFor(place)`, `findSeat`, `standSpot`, `seatZones` (prompt kind `seat`, code `t3:1`), `SEAT_REACH` 2.4.
- `floors.ts`: room layouts by capacity (`roomLayout`), seat prompt zones on every scene.
- `rooms.ts`: `PublicRoom.capacity`, create-only `capacity` input (2–8).
- `calls.ts`: `CallMember {id, name, mic, cam, screen, seat}`, `CallState {kind, table, members}`, stream id format, camera and screen constraints.
- `protocol.ts`: client `sit`, `stand`, `media`, `signal`; server `seat`, `seat_denied`, `call`, `signal`. The old `voice_*` messages are removed. `PublicPlayer.seat`.

## Server
- Migration `005_room_capacity`. Room gate uses the room's capacity.
- Hub: seat map per channel; `sit`/`stand`/`freeSeat`; `callKey` per connection (room channel, or `<channel>#<table>`); `syncCall` on every scene change, sit, stand and disconnect; `sendCall` pushes the member list to all members; `relaySignal` only within one call; media flags reset when leaving a call.

## Web
- `net/call.ts` `CallClient`: one per visit; WebRTC mesh with perfect negotiation (polite side = smaller id), tracks added and removed on demand (mic, camera, screen), remote streams matched to the stream ids members announce, speaking detection with an AudioContext primed on the first gesture.
- `ui/MeetingView.tsx`: tiles, call controls, fold button, Stand up; `CallBar` in rooms when not seated.
- `three/Tables.tsx`: round and long tables with chairs; avatars sit (`Motion.sitting`); the room interior uses the long table.
- Permissions-Policy allows camera, microphone and display capture for this origin only.

## Testing
Server: `calls.test.ts` (reach, taken chair, invalid tables, call membership and isolation, media, disconnect and elevator, room calls and capacity). Shared: seat and table tests. E2E: `voice.spec.ts` (room call with real audio between two browsers, meeting view, camera) and the Diner table test.
