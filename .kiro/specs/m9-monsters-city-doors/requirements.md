# Requirements — Milestone 9: Monster variety, night city, room doors

Owner request (2026-11-08), with Kiro's proposal accepted ("oke"):
1. Rooms on floors 2 and 3 too, so guests can say "meet in 2B".
2. A night city visible below the rooftop.
3. More NPC variety (vampire, monster, …), and the same variety in the character creator.

## Requirement 1 — Monster variety (characters and NPCs)
1. THE creator SHALL add heads: vampire, werewolf, Frankenstein's monster, zombie, alien; hats: pirate tricorn, bat ears; costumes: bat wings, skeleton, wizard robe, zombie rags, werewolf fur.
2. Stored looks from before SHALL stay valid (enums only grow).
3. NPCs SHALL be able to use the character system (`look`) as well as the classic sheet ghost.
4. The cast SHALL grow to 2–3 NPCs per floor: lobby (Mortimer the vampire concierge, Sergeant Wraps the mummy doorman, plus the ghosts), floor 2 (The Curator, a Frankenstein's monster; Lady Whisper, a ghost), floor 3 (Gourdon, a werewolf gardener; a zombie apprentice), floor 4 (Stella, a witch stargazer; Zorp, an alien tourist). Each has its own lines.

## Requirement 2 — Night city below the rooftop
1. Floor 4 SHALL feel like the top of a tall building: the hotel façade drops away below the parapet, and a low-poly city spreads out far below.
2. THE city SHALL have hundreds of buildings with lit windows, landmark towers (a clock tower with a glowing face, a gothic church spire, a tall tower with a blinking red antenna light), streets with moving car lights, a river reflecting the moon, and a lit bridge.
3. THE city SHALL be built with instancing so phones stay smooth, and SHALL fade into fog with distance.

## Requirement 3 — Rooms behind coded doors
1. Rooms SHALL live behind numbered doors: floor 1 doors 1A–1D (west and east walls), floor 2 doors 2A–2F (gallery north wall), floor 3 doors 3A–3D (greenhouse north wall). The code (e.g. "2B") is the room's address while the room exists.
2. The house rooms SHALL take 1A–1C; 1D and all of floors 2–3 are for guests.
3. Creating a room SHALL pick a floor (default: the guest's current floor if it has space) and the server SHALL assign the first free door, or a requested free door. IF the floor is full, THEN THE server SHALL answer 409 with a clear message.
4. Each door SHALL show its code, the room name and lock state, or "Vacant". Doors update live for everyone on that floor (create, change, delete, occupancy).
5. WHEN a guest walks up to a door and presses E (or taps), THE app SHALL enter the room (with the password prompt if needed), or offer to open a new room behind that door if it is vacant.
6. Leaving a room SHALL return the guest to the floor of that room, standing in front of its door.
7. THE room directory and the HUD SHALL show the code (e.g. "2B · Witching Hour").
8. Rooms unused for 3 days SHALL be released automatically (not house rooms, never while occupied), so doors cannot run out during judging.
9. Existing rooms SHALL be migrated onto free doors.

## Acceptance criteria
- A guest on floor 2 can create a room, gets a code like "2A", and a friend can find it by walking to door 2A.
- Leaving the room puts you in front of its door on the same floor.
- Door labels update for everyone on the floor without reloading.
- A full floor gives a clear error; a deleted room frees its door.
- All new costume parts are selectable and render; NPCs of every type appear.
- The rooftop shows a city at night.
