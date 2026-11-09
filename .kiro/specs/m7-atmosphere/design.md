# Design — Milestone 7: Atmosphere and NPC ghosts

## Shared (`packages/shared/src/npcs.ts`)
- `NpcDef { id, name, tint, scale, scene: "lobby" | "room", pose(t): { x, z, ry }, lines: string[] }`.
- Lobby NPCs:
  - Wisp: loop around the fountain, radius 4.2.
  - Boo-ella: figure eight across the hall.
  - Sir Floats-a-Lot: patrols along the north side.
  - Mortimer: the receptionist, fixed behind the desk (`z = -9.6`).
- Room NPC: "The Host", circling the table at radius 3.
- `t` is wall-clock seconds, so clients agree up to their clock skew. A unit test samples every path for 10 minutes and checks the walls.
- `greeting(name)` and `roomHostLines(game)` give the receptionist and host their lines.

## Server
- `db/house.ts` `ensureHouseRooms(pool)`: upserts the Concierge guest (fixed UUID, random token hash that no cookie can produce) and three rooms (fixed UUIDs). Uses `ON CONFLICT (id) DO NOTHING` and is called from `buildApp` after `migrate`.

## Web
- `three/Npcs.tsx`: a translucent sheet ghost with tint and glowing eyes, bobbing and swaying. It reads the shared pose each frame, registers a name-tag anchor `npc:<id>` and checks the distance to the local player (shared `selfPos` ref written by `LocalPlayer`).
- Name tags: NPC tags use `data-testid="nametag-npc"` and the class `nametag--npc` (italic, ghostly). Bubbles use the existing bubble style.
- Greeting: 1.2 s after entering the lobby, Mortimer says `greeting(name)` for 7 s.
- `ui/ambience.ts`: one AudioContext. A low drone (two detuned sines through a lowpass), filtered-noise wind with a slow LFO, and an owl hoot every 18–40 s. Master gain 0.05. Resumes on the first pointerdown or keydown if the context is suspended. The toggle is stored in `localStorage` (`ghostel:ambience`), default on.
- HUD: a 🎵 toggle next to the status pill.
- CSS: the phone HUD shows the place name (ellipsis). The room base light goes up.

## Testing
- Unit: NPC paths inside the walls and off the fountain, desk and table; deterministic poses; greeting text.
- Integration: house rooms are listed for a new guest with `mine: false`; PATCH and DELETE return 403; seeding twice keeps three rooms.
- E2E: the lobby shows NPC tags (not counted in the guest count); Mortimer greets the guest by name; the directory lists the house rooms; entering "Pumpkin Trivia Hall" shows The Host; the ambience toggle flips `aria-pressed`.
