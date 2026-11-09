import { LOBBY_LAYOUT, ROOM_BOUNDS, ROOM_OBSTACLES, roomSpawnPoint, type Bounds, type Layout, type Obstacle, type Vec2 } from "./layout";
import { DOOR_ZONE_RADIUS, doorsOnFloor, inFrontOf } from "./doors";
import { COUNTER_REACH, COUNTER_SPOT } from "./canteen";
import { FLOOR_TABLES, roomTable, seatZones, tableObstacles, tablesFor } from "./tables";
import type { Place } from "./protocol";

export type FloorNumber = 1 | 2 | 3 | 4 | 5;
export type UpperFloor = 2 | 3 | 4 | 5;

export const FLOORS: readonly { floor: FloorNumber; name: string; tagline: string }[] = [
  { floor: 1, name: "Grand Lobby", tagline: "Check in, chat, and find the room doors." },
  { floor: 2, name: "Hall of Portraits", tagline: "Watchful paintings, a costume runway and the Mirror of Costumes." },
  { floor: 3, name: "Moonlit Greenhouse", tagline: "Giant glowing pumpkins and a bubbling cauldron." },
  { floor: 4, name: "Ghoul's Diner", tagline: "Midnight snacks, lots of tables and a cook who is mostly bones." },
  { floor: 5, name: "Rooftop Graveyard", tagline: "Open sky, a huge moon, honest tombstones and the city lights below." },
];

export function floorName(floor: FloorNumber): string {
  return FLOORS.find((f) => f.floor === floor)?.name ?? "Unknown floor";
}

export function isFloorNumber(value: unknown): value is FloorNumber {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

const jitter = (rng: () => number, span: number) => (rng() - 0.5) * span;

// ---- Floor 2: Hall of Portraits (long gallery, elevator west, mirror east) ----
export const GALLERY_BOUNDS: Bounds = { minX: -18, maxX: 18, minZ: -5, maxZ: 5 };
/** Suits of armour line the south side; the north wall holds doors and portraits. */
export const GALLERY_OBSTACLES: readonly Obstacle[] = [-12, -6, 6, 12].map((x) => ({ kind: "circle" as const, label: "armour", x, z: 4.3, r: 0.45 }));
/** Portrait x positions on the north wall, between the room doors (elevator west end, mirror east end). */
export const GALLERY_PORTRAITS: readonly number[] = [-10, -5, 0, 5, 10];
export const GALLERY_MIRROR = { x: 16.5, z: -5 } as const;

// ---- Floor 3: Moonlit Greenhouse ----
export const GREENHOUSE_BOUNDS: Bounds = { minX: -14, maxX: 14, minZ: -11, maxZ: 11 };
export const GREENHOUSE_OBSTACLES: readonly Obstacle[] = [
  { kind: "circle", label: "cauldron", x: 0, z: 0, r: 1.4 },
  { kind: "circle", label: "giant-pumpkin", x: -8, z: -5, r: 1.6 },
  { kind: "circle", label: "giant-pumpkin", x: 8, z: -5, r: 1.6 },
  { kind: "circle", label: "giant-pumpkin", x: -8, z: 6, r: 1.3 },
  { kind: "circle", label: "giant-pumpkin", x: 8, z: 6, r: 1.3 },
  { kind: "box", label: "planter", minX: -13.6, maxX: -12, minZ: -8, maxZ: 8 },
  { kind: "box", label: "planter", minX: 12, maxX: 13.6, minZ: -8, maxZ: 8 },
];

// ---- Floor 4: Ghoul's Diner (canteen) ----
export const CANTEEN_BOUNDS: Bounds = { minX: -16, maxX: 16, minZ: -11, maxZ: 11 };
/** The food counter runs along the north wall; the cook works behind it. */
export const CANTEEN_COUNTER = { minX: -4.5, maxX: 8.5, minZ: -11, maxZ: -8.6 } as const;
export const CANTEEN_OBSTACLES: readonly Obstacle[] = [{ kind: "box", label: "counter", ...CANTEEN_COUNTER }];

// ---- Floor 5: Rooftop Graveyard ----
export const ROOFTOP_BOUNDS: Bounds = { minX: -15, maxX: 15, minZ: -11, maxZ: 11 };
export const ROOFTOP_TOMBSTONES: readonly Vec2[] = [
  { x: -11, z: 4 },
  { x: -8.5, z: 4 },
  { x: -6, z: 4 },
  { x: -11, z: 7 },
  { x: -8.5, z: 7 },
  { x: -6, z: 7 },
];
export const ROOFTOP_OBSTACLES: readonly Obstacle[] = [
  { kind: "circle", label: "water-tower", x: -11, z: -7, r: 1.6 },
  { kind: "circle", label: "telescope", x: 10, z: -7.5, r: 0.8 },
  { kind: "box", label: "mausoleum", minX: 8.5, maxX: 11.5, minZ: 4.5, maxZ: 7.5 },
  ...ROOFTOP_TOMBSTONES.map((t) => ({
    kind: "box" as const,
    label: "tombstone",
    minX: t.x - 0.45,
    maxX: t.x + 0.45,
    minZ: t.z - 0.18,
    maxZ: t.z + 0.18,
  })),
];

/** Where each floor's elevator door is, and where guests step out of it. */
export const ELEVATORS: Record<FloorNumber, { door: Vec2; facing: "north" | "west"; arrive: (rng?: () => number) => Vec2 }> = {
  1: { door: { x: 7.75, z: -10 }, facing: "north", arrive: (rng = Math.random) => ({ x: 7.75 + jitter(rng, 1), z: -8.6 }) },
  // On the north wall like every other elevator: side-wall doors are seen edge-on by the follow camera.
  2: { door: { x: -16.5, z: -5 }, facing: "north", arrive: (rng = Math.random) => ({ x: -16.5 + jitter(rng, 1), z: -2.8 }) },
  3: { door: { x: 0, z: -11 }, facing: "north", arrive: (rng = Math.random) => ({ x: jitter(rng, 1), z: -9.4 }) },
  4: { door: { x: -12, z: -11 }, facing: "north", arrive: (rng = Math.random) => ({ x: -12 + jitter(rng, 1), z: -9.4 }) },
  5: { door: { x: 0, z: -11 }, facing: "north", arrive: (rng = Math.random) => ({ x: jitter(rng, 1), z: -9.4 }) },
};

const withTables = (floor: FloorNumber, obstacles: readonly Obstacle[]): Obstacle[] => [...obstacles, ...tableObstacles(FLOOR_TABLES[floor])];

export const FLOOR_LAYOUTS: Record<UpperFloor, Layout> = {
  2: { bounds: GALLERY_BOUNDS, obstacles: withTables(2, GALLERY_OBSTACLES), spawn: ELEVATORS[2].arrive },
  3: { bounds: GREENHOUSE_BOUNDS, obstacles: withTables(3, GREENHOUSE_OBSTACLES), spawn: ELEVATORS[3].arrive },
  4: { bounds: CANTEEN_BOUNDS, obstacles: withTables(4, CANTEEN_OBSTACLES), spawn: ELEVATORS[4].arrive },
  5: { bounds: ROOFTOP_BOUNDS, obstacles: withTables(5, ROOFTOP_OBSTACLES), spawn: ELEVATORS[5].arrive },
};

export type PromptKind = "door" | "elevator" | "mirror" | "counter" | "seat";
export interface PromptZone {
  kind: PromptKind;
  x: number;
  z: number;
  r: number;
  /** Door code for `kind: "door"`, seat code ("t3:1") for `kind: "seat"`. */
  code?: string;
}

function doorZones(floor: number): PromptZone[] {
  return doorsOnFloor(floor).map((d) => ({ kind: "door" as const, code: d.code, r: DOOR_ZONE_RADIUS, ...inFrontOf(d, 0.9) }));
}

function elevatorZone(floor: FloorNumber): PromptZone {
  const { door, facing } = ELEVATORS[floor];
  return facing === "north" ? { kind: "elevator", x: door.x, z: door.z + 0.9, r: 1.9 } : { kind: "elevator", x: door.x + 0.9, z: door.z, r: 1.9 };
}

/** Stable key for a place: "lobby", "floor:2", "room:<id>". */
export function sceneKeyFor(place: Place): string {
  if (place.kind === "lobby") return "lobby";
  if (place.kind === "floor") return `floor:${place.floor}`;
  return `room:${place.room.id}`;
}

export function floorOfPlace(place: Place): FloorNumber | null {
  if (place.kind === "lobby") return 1;
  if (place.kind === "floor") return place.floor;
  return null;
}

const roomLayouts = new Map<number, Layout>();
/** A room's walls, corner props and its long table (sized by the room's capacity). */
export function roomLayout(capacity: number): Layout {
  const table = roomTable(capacity);
  let layout = roomLayouts.get(table.seats.length);
  if (!layout) {
    layout = { bounds: ROOM_BOUNDS, obstacles: [...ROOM_OBSTACLES, table.obstacle], spawn: roomSpawnPoint };
    roomLayouts.set(table.seats.length, layout);
  }
  return layout;
}

export function layoutForPlace(place: Place): Layout {
  if (place.kind === "lobby") return LOBBY_LAYOUT;
  if (place.kind === "floor") return FLOOR_LAYOUTS[place.floor];
  return roomLayout(place.room.capacity);
}

/** Spots where walking up shows a prompt (E / tap). */
export function promptZones(place: Place): readonly PromptZone[] {
  if (place.kind === "lobby") {
    return [...doorZones(1), elevatorZone(1), ...seatZones(tablesFor(place))];
  }
  if (place.kind === "room") return seatZones(tablesFor(place));
  if (place.kind === "floor") {
    const zones = [...doorZones(place.floor), elevatorZone(place.floor), ...seatZones(tablesFor(place))];
    if (place.floor === 2) zones.push({ kind: "mirror", x: GALLERY_MIRROR.x, z: GALLERY_MIRROR.z + 1.1, r: 2 });
    if (place.floor === 4) zones.push({ kind: "counter", x: COUNTER_SPOT.x, z: COUNTER_SPOT.z, r: COUNTER_REACH });
    return zones;
  }
  return [];
}
