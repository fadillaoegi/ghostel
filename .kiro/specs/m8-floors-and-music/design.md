# Design — Milestone 8

> **Updated by M10.** The building now has five floors: Ghoul's Diner is floor 4 and the rooftop moved to floor 5 (`m10-canteen-and-rooftop`). This spec is kept as the record of milestone 8.

## Shared
- `floors.ts`
  - `FLOORS`: 1–4 with name and tagline.
  - Layouts for floors 2–4, all keeping the camera-friendly low south wall:
    - Floor 2: x −18..18, z −5..5, armour circles.
    - Floor 3: x −14..14, z −11..11, cauldron, giant pumpkins and planter boxes.
    - Floor 4: x −15..15, z −11..11, water tower, telescope, mausoleum and tombstones.
  - `ELEVATORS[floor]`: door position and arrival spawn. `ZONES[sceneKey]`: prompt zones (`rooms`, `elevator`, `mirror`).
  - `layoutForPlace(place)`.
- `Place` gains `{ kind: "floor"; floor: 2 | 3 | 4 }`. Floor 1 stays `{ kind: "lobby" }`.
- `candies.ts`: 12 `{ id, floor, x, z }`, `CANDY_REACH` (client) 1.2 and `CANDY_SERVER_REACH` 2.0 (allows for network lag), `CROWN_CANDIES = 12`.
- `profile.ts`: `HATS` gains `"crown"`. `crownUnlocked(candies)`.
- Protocol:
  - client `{ t: "floor", floor: 1..4 }` and `{ t: "collect", candy }`.
  - server `{ t: "candies", found: string[] }` (to all tabs of that guest), `{ t: "candy_found", id, name }` (to the channel), and `welcome.candies`.
- `npcs.ts`: one ghost per new floor (The Curator, Gourdon the Gardener, Stargazer Stella), plus static "talkers": portraits on floor 2 and tombstones on floor 4, each with a position and lines but no name tag.

## Server
- Migration `003_candies`: `guests.candies text[] NOT NULL DEFAULT '{}'`. `GuestRepository.addCandy(id, candy)` uses an atomic `array_append … WHERE NOT candy = ANY(candies)` and returns the list.
- `Guest` carries `candies`. `PUT /api/me` rejects `hat: "crown"` unless `crownUnlocked`; `GET /api/me` returns `candies`.
- Hub: `channel` `floor:n`; `moveTo` takes an arrival point (elevator spawn). `floor` → lobby or floor channel, only from lobby or floors (not from rooms; rooms have "back to lobby"). `collect`: validate the id, floor ↔ channel, and server position distance; then an async `CandyStore.add` (injected); then `candies` to the guest's tabs and `candy_found` to the channel. Completing 12 adds a notice.

## Web
- `three/floors/{Gallery,Greenhouse,Rooftop}.tsx` environments, `three/Elevator.tsx` (shared doors, used in the lobby too), `three/Candies.tsx` (spinning wrapped sweets with glow, hidden once found; sends `collect` when within reach).
- `WorldScene` picks the environment, layout, NPCs and talkers from the place. Prompt zones replace `onNearDoor` with `onPrompt(kind | null)`.
- `ui/ElevatorPanel.tsx`; HUD: elevator button, candy counter, floor name in the place title.
- Creator: the crown chip is locked (🔒 "Find all 12 candies") until unlocked.
- `ui/music.ts` replaces `ambience.ts`:
  - A lookahead scheduler (25 ms tick, 120 ms ahead) with instruments: music box (sine plus an octave partial, fast decay), harpsichord (filtered saw pluck), celesta (triangle with a bell partial), theremin (sine with vibrato and glide), bass and pad.
  - A generated-impulse reverb. Scores live in `ui/scores.ts` as bars of `[note, beats]` with chords.
  - Cross-fades over 1.5 s.

## Testing
- Shared unit: floor layouts (spawns, elevators and candies walkable), candy definitions (12 unique, 3 per floor), NPC and talker paths inside the walls, crown rule, new protocol messages.
- Web unit (Vitest, new in `apps/web`): every score bar sums to the theme's beats per bar, notes are in range, every theme is defined.
- Server integration: floor travel and isolation, elevator arrival spawn, candy collection rules (wrong floor, too far, forged id, duplicate, persistence, tabs sync), crown gate.
- E2E: elevator to floors 2–4 (NPC tags, place names), mirror prompt opens the costume editor, collect the lobby candy next to the spawn, music toggle; screenshots per floor.
