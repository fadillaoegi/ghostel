# Requirements — Milestone 4: Rooms

Guests create their own rooms for meetings or games. Rooms are separate 3D scenes reached from the lobby's room doors. Owners can lock a room or protect it with a password, and the server enforces both.

## Decisions (2026-11-07, owner: "sesuai kamu rekomendasikan")
- Rooms are separate scenes, each its own realtime channel (presence, movement, chat).
- First game is Pumpkin Trivia (milestone 6). A room already stores its game type.

## Requirement 1 — Creating and managing rooms
1. A guest SHALL be able to create a room with name (3–30 characters), decoration theme (crypt, library, ballroom), game (none, Pumpkin Trivia) and access mode (open, locked, password).
2. THE server SHALL store rooms in PostgreSQL (name, owner, password hash, decoration, game, access).
3. A guest SHALL own at most 3 rooms. Over the limit THE server SHALL respond 409 with a clear message.
4. ONLY the owner SHALL change or delete a room. Others SHALL get 403 (or 404 for an unknown room). The owner is identified by the session cookie, never by request data.
5. WHEN a room is deleted, THE server SHALL move everyone inside back to the lobby with a notice.
6. WHEN the owner changes a room, guests inside SHALL see the new name and theme without reloading.

## Requirement 2 — Access control (server-enforced)
1. `open`: anyone may enter while the room has space (capacity 8).
2. `locked`: only the owner may enter. Guests already inside stay.
3. `password`: entering requires the password, checked on the server against an argon2id hash. The password and its hash SHALL NEVER be sent to any client or written to logs.
4. Passwords are 4–64 characters, any printable characters, not trimmed.
5. THE server SHALL limit password attempts to 5 per minute per guest and room.
6. IF entry is refused, THEN THE server SHALL reply with a specific reason (not found, locked, password required, wrong password, too many attempts, full) and the guest SHALL stay where they are.
7. Guests outside a room SHALL NOT receive that room's presence, movement, chat or (later) voice signaling and game state. Guests in a room SHALL NOT receive lobby traffic.

## Requirement 3 — Room directory and navigation
1. THE lobby SHALL offer a room directory (HUD button and the lobby's room doors) listing rooms with name, owner name, access icon, theme, game and occupancy.
2. WHEN a guest walks up to a room door, THE UI SHALL show a prompt (E on desktop, a button on touch) that opens the directory.
3. Entering a password room SHALL show a password prompt. A wrong password SHALL show an error and keep the prompt open.
4. Inside a room, THE HUD SHALL show the room name and access icon, a "Back to lobby" button, and for the owner a "Room settings" button.
5. Rooms SHALL look different per theme (palette and props) and have a central table for future games.

## Acceptance criteria
- A password is never visible in any API response, WebSocket message or browser storage.
- A wrong password never lets a guest in, and repeated guessing is throttled.
- A guest outside a locked room cannot read its chat or see its occupants move.
- Only the owner can rename, re-lock or delete a room.
- Works on desktop and phone.
