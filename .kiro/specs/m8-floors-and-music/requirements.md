# Requirements — Milestone 8: Four floors, melodic music, candy hunt

> **Updated by M10.** The building now has five floors: Ghoul's Diner is floor 4 and the rooftop moved to floor 5 (`m10-canteen-and-rooftop`). This spec is kept as the record of milestone 8.

Owner request (2026-11-08): replace the background sound with fitting melodic music; make the building bigger: floor 1 is the lobby and floors 2–4 are new, made interesting; then report which competition category each part of the app serves.

## Requirement 1 — Melodic music
1. THE hotel SHALL play original, procedurally performed Halloween music (no audio files, no third-party recordings) instead of the drone/wind ambience.
2. Each floor SHALL have its own theme: lobby (music-box waltz, D minor), Hall of Portraits (harpsichord minuet, A minor), Moonlit Greenhouse (celesta lullaby, F major), Rooftop Graveyard (theremin nocturne, E minor). Rooms use a softer lobby waltz.
3. WHEN the guest changes floor, THE music SHALL cross-fade to that floor's theme.
4. THE existing 🎵 toggle SHALL control the music and remember the choice. Music starts only after a user gesture.

## Requirement 2 — Floors and elevator
1. THE building SHALL have four floors: 1 Grand Lobby (existing), 2 Hall of Portraits, 3 Moonlit Greenhouse, 4 Rooftop Graveyard.
2. Every floor SHALL have an elevator. WHEN a guest walks up to it, a prompt (E / tap) SHALL open an elevator panel listing the floors. The HUD SHALL also have an elevator button outside rooms.
3. Each floor SHALL be its own realtime channel (presence, movement, chat), with server-authoritative walls and obstacles, like the lobby.
4. Floor content:
   - Floor 2, Hall of Portraits: a long gallery of haunted portraits whose eyes follow the guest and who speak when approached, a costume runway lit by spotlights, suits of armour, and the Mirror of Costumes, which opens the costume editor when approached.
   - Floor 3, Moonlit Greenhouse: giant glowing pumpkins that brighten as you pass, a bubbling cauldron, fireflies and glass walls under the moon.
   - Floor 4, Rooftop Graveyard: open sky with a huge moon, a graveyard whose tombstones show funny epitaphs when approached, a water tower, a telescope and a mausoleum.
   - Each floor has its own NPC ghost with lines.
5. Rooms stay reachable from the lobby doors only.

## Requirement 3 — Candy hunt (reason to explore all floors)
1. Twelve candies SHALL be hidden across the four floors (three per floor).
2. WHEN a guest walks onto a candy, THE client SHALL ask to collect it. THE server SHALL accept only if the guest is on that candy's floor and the server-side position is within reach, and SHALL store it on the guest's profile (PostgreSQL), so progress survives reloads.
3. THE HUD SHALL show progress (🍬 n/12). Other guests on the same floor see a notice when someone finds a candy.
4. WHEN all twelve are found, THE guest SHALL unlock the Golden Crown hat. THE server SHALL reject the crown in a profile update until it is unlocked.

## Requirement 4 — Category report
1. `docs/CATEGORY-REPORT.md` SHALL map the app's parts to the Kiroween 2026 categories and judging needs, citing the source of the category list, and saying which facts are unverified.

## Acceptance criteria
- Changing floors changes the scene, the guests you see, the chat and the music.
- A candy cannot be collected from another floor or from far away, even with a forged message.
- The crown is locked until 12/12 and then selectable.
- All earlier tests keep passing.
