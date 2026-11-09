# Design — Milestone 4: Rooms

## packages/shared
- `rooms.ts`
  - Enums: `ROOM_ACCESS = ["open","locked","password"]`, `ROOM_DECORS = ["crypt","library","ballroom"]`, `ROOM_GAMES = ["none","pumpkin_trivia"]`.
  - `ROOM_CAPACITY = 8`, `MAX_ROOMS_PER_GUEST = 3`.
  - `validateRoomName` (NFC, collapse whitespace, 3–30 chars, letters/numbers/space and `- _ . ' ! ? & , :`, starts with a letter or number).
  - `validateRoomPassword` (NFC only, no trim, 4–64 code points, no control characters).
  - `parseRoomInput(body, mode: "create" | "update")` returns field-specific messages. Switching to `password` on create requires a password; on update it is required only if the room had no password before (the server decides).
  - `PublicRoom { id, name, ownerName, access, decor, game }`, `RoomSummary = PublicRoom & { occupants, mine }`.
- `layout.ts` gains `Layout { bounds, obstacles, spawn }`. `LOBBY_LAYOUT` and `ROOM_LAYOUT`: the room floor is x −8..8, z −6..6, with a central table (circle r 1.6) and two corner props. The `resolveMove` and `constrainToWorld` signatures take a layout.
- `protocol.ts`
  - Client → server: `{ t: "enter", room: uuid, password?: string(≤200) }`, `{ t: "exit" }`.
  - Server → client: `welcome` gains `place: { kind: "lobby" } | { kind: "room", room: PublicRoom, owner: boolean }`; `{ t: "enter_failed", code, message }`; `{ t: "room", room: PublicRoom }` (settings changed); `{ t: "notice", message }`.

## Server
- Migration `002_rooms`: `rooms(id uuid pk, owner_id uuid fk guests on delete cascade, name, access check in (...), password_hash text null, decor, game, created_at, updated_at)`, plus a check that `password_hash` is set exactly when `access = 'password'`, and an index on `owner_id`.
- `db/rooms.ts` `RoomRepository`: `list(limit)`, `countByOwner`, `create`, `update`, `delete`, `findForEntry(id)` (includes `owner_id` and `password_hash`, only used by the access check). Public queries never select `password_hash`.
- `security/passwords.ts`: `hashPassword` and `verifyPassword` with `@node-rs/argon2` (argon2id defaults: m=19456 KiB, t=2, p=1, the OWASP baseline). Prebuilt binaries, no install script.
- Routes (`http/rooms.ts`), all need a valid guest cookie (401 otherwise); the `:id` parameter must be a UUID (else 404):
  - `GET /api/rooms` → `{ rooms: RoomSummary[] }` (occupants from the hub, `mine` for the caller).
  - `POST /api/rooms` → 201 `{ room }`; 400 field errors; 409 room limit.
  - `PATCH /api/rooms/:id` → owner only; `{ room }`; notifies `hub.updateRoom`.
  - `DELETE /api/rooms/:id` → owner only; 204; `hub.closeRoom`.
  - Writes share the origin check and a per-IP limit (30/min).
- Hub channels: each connection has a `channel` (`lobby` or `room:<id>`) and a `place`. Welcome, join, leave, snap, profile and chat are scoped to the channel. Chat history is per channel and dropped when a room empties.
- `enter` is async: `conn.entering` guards against double requests. The hub calls an injected `RoomAccess.check(guestId, roomId, password, occupants)` (repository + argon2 + attempt limiter, 5/min per guest+room). The hub re-checks that the socket is still open and there is still space after the await. Then `moveTo`: leave the old channel, spawn in the new layout, send welcome, announce join.
- `exit` → back to the lobby. `closeRoom(id)` → everyone inside moves to the lobby, followed by a `notice`.
- `updateRoom(room)` → occupants get `{ t: "room" }`.
- Owner bypass: the owner may always enter their own room (also when locked) and does not need the password.

## Web
- `PresenceClient`: `place`, `enterError` (cleared on success), `notice`, `sendEnter(roomId, password?)`, `sendExit()`. A welcome resets players, chat and bubbles for the new channel.
- `WorldScene` (renamed from `LobbyScene`) takes the layout and an environment: `LobbyHall + Decor` or `RoomInterior` (themes: crypt = green candles and coffins, library = violet and bookshelves, ballroom = orange and chandelier). `LocalPlayer` uses the layout for prediction and reports when it is near a room door.
- `RoomDirectory` modal: list (polls `GET /api/rooms` every 3 s while open), "Enter", "Create a room" form. The password prompt appears when the server answers `password_required` or `wrong_password`.
- `RoomSettings` modal (owner): edit name, theme, game, access and password; delete.
- HUD: place title, "🚪 Rooms" in the lobby, "← Lobby" and "⚙ Settings" in rooms, door prompt.
- Lobby door labels change from "opening soon" to "Rooms".

## Testing
- Unit: room name/password validation, `parseRoomInput`, `ROOM_LAYOUT` walkability.
- Integration: REST ownership and limits; the password never appears in responses (compared against stored data); an argon2id hash is stored; WebSocket entry for each access mode; attempt throttling; channel isolation (chat and snapshots); members stay after a lock; delete moves members to the lobby; capacity.
- E2E: owner creates a password room and enters; a friend fails with a wrong password, then enters with the right one; both see each other; a third guest in the lobby does not see the room chat; back to the lobby; phone screenshots.
