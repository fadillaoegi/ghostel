import { FLOOR_TABLES, longTable, tableObstacles } from "./tables";

export interface Vec2 {
  x: number;
  z: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type Obstacle =
  | { kind: "circle"; label: string; x: number; z: number; r: number }
  | { kind: "box"; label: string; minX: number; maxX: number; minZ: number; maxZ: number };

export const PLAYER_RADIUS = 0.4;

/** Walkable floor of the grand lobby (world units ≈ metres). North is −z. */
export const LOBBY_BOUNDS: Bounds = { minX: -14, maxX: 14, minZ: -10, maxZ: 10 };

export const LOBBY_OBSTACLES: readonly Obstacle[] = [
  { kind: "circle", label: "fountain", x: 0, z: 0, r: 1.9 },
  { kind: "box", label: "reception", minX: -3.2, maxX: 3.2, minZ: -9.2, maxZ: -7.8 },
  { kind: "circle", label: "pillar", x: -10, z: -6, r: 0.6 },
  { kind: "circle", label: "pillar", x: -10, z: 0, r: 0.6 },
  { kind: "circle", label: "pillar", x: -10, z: 6, r: 0.6 },
  { kind: "circle", label: "pillar", x: 10, z: -6, r: 0.6 },
  { kind: "circle", label: "pillar", x: 10, z: 0, r: 0.6 },
  { kind: "circle", label: "pillar", x: 10, z: 6, r: 0.6 },
];

/** Guests appear near the front doors (south side). */
export function spawnPoint(rng: () => number = Math.random): Vec2 {
  return { x: (rng() - 0.5) * 6, z: 7 + rng() * 1.5 };
}

/** Walkable area, obstacles and spawn rule of one scene. */
export interface Layout {
  bounds: Bounds;
  obstacles: readonly Obstacle[];
  spawn: (rng?: () => number) => Vec2;
}

/** The lobby's walls plus its tables (see `tables.ts`). */
export const LOBBY_LAYOUT: Layout = { bounds: LOBBY_BOUNDS, obstacles: [...LOBBY_OBSTACLES, ...tableObstacles(FLOOR_TABLES[1])], spawn: spawnPoint };

/** Lobby room doors (west and east walls). Walking close to one opens the room directory prompt. */
export const LOBBY_DOORS: readonly Vec2[] = [
  { x: LOBBY_BOUNDS.minX + 0.5, z: 0 },
  { x: LOBBY_BOUNDS.maxX - 0.5, z: 0 },
];
export const DOOR_PROMPT_RADIUS = 2.6;

export const ROOM_BOUNDS: Bounds = { minX: -8, maxX: 8, minZ: -6, maxZ: 6 };

/** Two corner props in every room. The long table depends on the room's capacity (see `roomLayout`). */
export const ROOM_OBSTACLES: readonly Obstacle[] = [
  { kind: "circle", label: "prop", x: -6.6, z: -4.6, r: 0.8 },
  { kind: "circle", label: "prop", x: 6.6, z: -4.6, r: 0.8 },
];

/** Guests enter rooms through the south door. */
export function roomSpawnPoint(rng: () => number = Math.random): Vec2 {
  return { x: (rng() - 0.5) * 4, z: 3.8 + rng() * 1.2 };
}

/** A full room (8 seats). Rooms with fewer seats use `roomLayout(capacity)`. */
export const ROOM_LAYOUT: Layout = { bounds: ROOM_BOUNDS, obstacles: [...ROOM_OBSTACLES, longTable(8).obstacle], spawn: roomSpawnPoint };
