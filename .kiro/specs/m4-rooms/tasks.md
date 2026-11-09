# Tasks — Milestone 4: Rooms

- [x] 1. Shared: `rooms.ts` validation + types, layouts (`LOBBY_LAYOUT`, `ROOM_LAYOUT`, `LOBBY_DOORS`), protocol messages, unit tests (14 new)
- [x] 2. Server: migration `002_rooms`, `RoomRepository`, argon2id password helpers (`security/passwords.ts`, `@node-rs/argon2` 2.2.2)
- [x] 3. Server: `/api/rooms` routes with ownership, limits, origin check
- [x] 4. Server: hub channels, async `enter` with injected `RoomGate`, `exit`, `updateRoom`, `closeRoom`
- [x] 5. Server integration tests (REST + WebSocket isolation + passwords), 13 new
- [x] 6. Web: PresenceClient place/enter/exit, `WorldScene` with layouts, `RoomInterior` themes (crypt, library, ballroom)
- [x] 7. Web: RoomDirectory, password prompt, RoomSettings, HUD changes, door prompt (E / tap)
- [x] 8. E2E: password room flow with three guests + phone ballroom; screenshots
  - Found: after sending a chat message the field kept focus, so walking keys were typed as text. The docked chat now blurs after sending.
  - Added `apps/server/scripts/reset-test-db.mjs` (refuses non-`*_test` databases) so E2E starts from an empty database.
- [x] 9. Evidence and docs
