# Design — Milestone 9

## 1. Monster variety
- `profile.ts`:
  - `HEADS` += `vampire`, `werewolf`, `frankenstein`, `zombie`, `alien`
  - `HATS` += `pirate`, `batears`
  - `COSTUMES` += `batwings`, `skeleton`, `wizard`, `tattered`, `fur`
- `Avatar.tsx`: new low-poly parts made from primitives (fangs, snout, flat head with bolts, almond eyes, tricorn, wing shapes, ribs, long robe, rags, fur collar). The wizard robe hides the legs like the ghost sheet. The bat wings flap gently.
- `NpcDef.look?: Look`: when set, the NPC renders the shared `Avatar` (with walk animation driven by its path speed); otherwise it renders the sheet ghost.
- Cast changes in `npcs.ts` (lines per NPC), with all paths unit-tested to stay inside walls and off obstacles.

## 2. Night city (`three/floors/City.tsx`)
- Placed below the roof (`y = -34` ground), in a ring from about 24 to 120 units around the hotel. Fog on floor 4 is extended (near 30, far 160).
- Buildings: one `InstancedMesh` per window style (3 canvas window textures with random lit windows, emissive maps), about 360 buildings, seeded RNG so the city is the same for everyone.
- The hotel's own façade: a tall box under the roof with window rows, so the guest stands on top of something.
- Landmarks: clock tower (glowing face), gothic church (spire and rose window), radio tower (blinking red light).
- Streets: a few straight avenues as dark strips with streetlight dots. Cars: an `InstancedMesh` of small emissive boxes moving along the avenues (white heading one way, red the other).
- River: a dark plane with a moon reflection strip and a bridge with a row of lights.
- Twinkle: `Sparkles` low over the city.

## 3. Rooms behind coded doors
### Shared
- `doors.ts`: `ROOM_FLOORS = [1, 2, 3]`, `DOOR_SLOTS = { 1: [A–D], 2: [A–F], 3: [A–D] }`, door positions per floor (`DOORS[floor][slot] = { x, z, facing }`), `doorCode(floor, slot)`, `doorZone`, the arrival point in front of a door, and `parseDoorCode`.
- Lobby doors 1A/1B on the west wall (z −3/+3) and 1C/1D on the east wall. The old single "Rooms" doors are removed.
- Gallery: doors on the north wall at x −12.5, −7.5, −2.5, 2.5, 7.5, 12.5; portraits move between them (x −10 … 10); armour stays only on the south side.
- Greenhouse: doors on the north wall at x −9, −4.5, 4.5, 9.
- `PublicRoom` += `floor`, `slot`. `RoomInput` += `floor?`, `slot?`.
- `promptZones(place)` gains `{ kind: "door", code }`.
- Protocol: server → client `{ t: "doors", doors: DoorInfo[] }` with `DoorInfo { code, room: PublicRoom | null, occupants }`, sent on welcome for lobby and floors, and broadcast to that floor's channel whenever a door changes.

### Server
- Migration `004_room_doors`: add `floor`, `slot`, `last_used_at`; assign existing rooms (house rooms first) to free doors in order (1A…1D, 2A…2F, 3A…3D), deleting rooms that do not fit; then `NOT NULL`, `CHECK`, and `UNIQUE (floor, slot)`.
- House rooms are seeded into 1A–1C.
- `RoomRepository.create` tries the requested slot or each free slot in order, relying on the unique constraint for races. `markUsed(id)` runs on entry. `releaseStale(days, occupiedIds)` deletes old unused guest rooms.
- Routes: `POST /api/rooms` accepts `floor`/`slot`; 409 `floor_full`. Create, update and delete notify the hub.
- Hub keeps `rooms: Map<id, PublicRoom>` loaded at startup and updated by the routes (`roomCreated`, `updateRoom`, `closeRoom`). `doorsFor(floor)` uses the map plus occupancy and is broadcast to the floor channel (lobby = floor 1) on room changes and on room entry and exit. Leaving a room moves the guest to the room's floor at its door.
- A cleanup timer (hourly, plus at startup) releases rooms unused for 3 days that are not occupied.

### Web
- `three/RoomDoors.tsx`: a door per slot with an arched frame, a lit code plaque, a name plate (or "Vacant") and a lock icon. Doors open slightly when someone is inside.
- The prompt for a door says "Press E to enter 2B · Witching Hour" or "Press E to open room 2B". Vacant doors open the create form with the floor and slot preset; password rooms open the password prompt.
- The directory shows code badges and floor filters; the create form has a floor picker with free-door counts.
- HUD: room title `🔑 2B · Witching Hour`; the leave button returns to the floor.

## Testing
- Unit: door layout (zones walkable, unique codes, arrival spots walkable, no overlap with portraits, elevators or mirror); city RNG determinism (pure helper); new look parts; NPC paths.
- Integration: create with a floor gives a code; requested slot; full floor 409; delete frees the door; the doors broadcast reaches the floor only; leaving a room lands at its door; migration of existing rooms; house rooms in 1A–1C; stale release.
- E2E: create a room on floor 2, a friend walks to the door and presses E, leaving returns in front of the door, door labels update live; new costume parts; NPC variety; rooftop city screenshot.
