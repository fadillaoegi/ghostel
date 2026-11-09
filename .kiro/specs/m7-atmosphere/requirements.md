# Requirements — Milestone 7: Atmosphere and NPC ghosts

Make the hotel feel alive for a judge who visits alone.

## Requirement 1 — NPC ghosts
1. THE lobby SHALL have at least three floating NPC ghosts that wander along their own paths, with name tags marked as hotel staff (not counted as guests).
2. A ghost receptionist SHALL float behind the reception desk.
3. WHEN a guest arrives in the lobby, THE receptionist SHALL greet them by name with a hint about the room doors.
4. WHEN a guest walks close to an NPC, THE NPC SHALL say a short line (speech bubble) with tips or jokes, at most once every 8 seconds per NPC.
5. Every room SHALL have a host ghost circling its table; in Pumpkin Trivia rooms it invites the guest to play.
6. NPC positions SHALL be a pure function of time and shared code, so every guest sees roughly the same ghosts in the same places without extra network traffic. NPCs SHALL stay inside the walls.

## Requirement 2 — House rooms
1. THE server SHALL keep three open house rooms owned by "The Concierge" so the room directory is never empty: "Pumpkin Trivia Hall" (ballroom, trivia), "Midnight Library" (library, trivia) and "The Quiet Crypt" (crypt, hang out).
2. Seeding SHALL be idempotent at startup. Nobody can edit or delete house rooms (no session can own them).

## Requirement 3 — Ambient sound
1. THE lobby and rooms SHALL have a quiet synthesized ambience (low drone, wind, an occasional owl), with no audio files.
2. THE HUD SHALL have an ambience toggle; the choice is remembered on the device. Audio starts only after a user gesture (browser rule).

## Requirement 4 — Polish carried over
1. On phones, THE HUD SHALL show the room name.
2. Rooms SHALL be readable (brighter base light).

## Acceptance criteria
- A first-time solo visitor sees moving ghosts, gets greeted by name, and finds rooms to enter right away.
- NPC tags never count as guests and never break guest-presence tests.
- House rooms cannot be changed by any guest.
