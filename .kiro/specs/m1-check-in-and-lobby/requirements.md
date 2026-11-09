# Requirements — Milestone 1: Check-in and live lobby

Covers project milestones 1 (character creation + guest name) and 2 (explorable building with realtime presence).

## Decisions recorded for this milestone (2026-11-07)
- Working directory: `/Users/boo/Github/project/Hacketon/ghostel` (owner chose this over `ghostturtle/ghostel`).
- Stack: option A, full TypeScript pnpm monorepo. Realtime transport: plain `ws` instead of Colyseus (see design.md, "Transport choice").
- First game (milestone 6): Pumpkin Trivia, recommended default, still open for the owner to change.
- Old project: left in place, not archived. Its dev launcher keeps running; Ghostel avoids its ports.
- Hosting: tentative, Render Free (single service) + Neon Free. Not deployed in this milestone.

## Requirement 1 — Guest session
**User story:** As a visitor, I want to start without an account so I can enter the hotel in seconds.
1. WHEN a visitor without a session saves a character, THE server SHALL create a guest, set an HttpOnly session cookie, and store only the SHA-256 hash of the session token.
2. WHEN a visitor with a valid session cookie loads the app, THE server SHALL return that guest's name and look, so a reload keeps them.
3. IF a request carries a missing, malformed or unknown session cookie, THEN THE server SHALL treat it as a new visitor and SHALL NOT reveal whether the token existed.
4. THE server SHALL only read or change the profile of the guest identified by the request's cookie. No API accepts a guest ID from the client.

## Requirement 2 — Character creation
**User story:** As a guest, I want to build a low-poly costumed character so others recognise me.
1. THE creator SHALL offer at least: body colour, accent colour, head (round, pumpkin, skull, cat), hat (none, witch, top hat, horns), costume (none, cape, ghost sheet, mummy wraps).
2. THE creator SHALL show a live 3D preview that updates on every change.
3. THE creator SHALL offer a "Surprise me" randomiser.
4. WHEN the server receives a look, THE server SHALL accept only known enum values and reject anything else with HTTP 400.

## Requirement 3 — Guest name
**User story:** As a guest, I want to choose and later change my display name.
1. THE server SHALL normalise names (Unicode NFC, trim, collapse inner whitespace) and accept 2–20 characters made of letters, numbers, spaces and `- _ . '`, starting with a letter or number.
2. IF a name is invalid, THEN THE server SHALL respond with HTTP 400 and a human-readable message, and THE UI SHALL show that message next to the field.
3. WHEN a guest changes name or look while in the lobby, THE server SHALL broadcast the new profile so other guests see it without reloading.
4. Names are not unique; identity is the guest ID.

## Requirement 4 — Explorable lobby
**User story:** As a guest, I want to walk around a spooky low-poly hotel lobby.
1. THE lobby SHALL be a low-poly 3D hall with Halloween decoration (pumpkins, lanterns, bats, moon, candles).
2. THE guest SHALL move with WASD/arrow keys on desktop and a virtual joystick on touch devices.
3. THE camera SHALL follow the guest's character.
4. THE client SHALL keep its character inside the building bounds and outside obstacles (same shared rules as the server).
5. THE layout SHALL be usable on desktop (≥1024 px) and phone (≈390×844) screens.

## Requirement 5 — Realtime presence (server-authoritative)
**User story:** As a guest, I want to see other guests and their names moving in realtime.
1. WHEN a guest with a valid session opens the lobby, THE server SHALL send them the current list of players (public connection ID, name, look, position) and announce the newcomer to everyone else.
2. WHEN the server receives a move, THE server SHALL reject non-finite numbers, clamp the position to building bounds, push it out of obstacles, and limit distance by max speed since the last accepted move.
3. IF the accepted position differs from the requested one, THEN THE server SHALL send a correction to the sender.
4. THE server SHALL broadcast only accepted positions, at a fixed tick (15 Hz).
5. WHEN a connection closes, THE server SHALL remove that character for everyone.
6. THE server SHALL reject WebSocket upgrades without a valid session cookie or from a disallowed Origin.
7. THE server SHALL cap WebSocket payload size, message rate and connections per guest.

## Acceptance criteria (owner-defined)
- Reload keeps name and character look.
- Two different guests cannot change each other's profile.
- Position cannot leave the building bounds even if the client sends fake values.
- An invalid name is rejected by the server with a clear message.
- The UI looks good on desktop and phone.
