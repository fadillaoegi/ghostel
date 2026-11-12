import type { Obstacle, Vec2 } from "./layout";
import type { PromptZone } from "./floors";
import type { Place } from "./protocol";

/** One chair: where a seated guest is placed and which way they face (towards the table). */
export interface SeatDef {
  x: number;
  z: number;
  ry: number;
}

export interface TableDef {
  /** Unique within its scene, e.g. "t1" or "long". */
  id: string;
  shape: "round" | "long";
  x: number;
  z: number;
  seats: readonly SeatDef[];
  /** Blocks walking; covers the table and its chairs. */
  obstacle: Obstacle;
  /** Long tables only: table top size. */
  width?: number;
  depth?: number;
}

/** Facing angle for an avatar at (x, z) looking at (tx, tz). Avatars face +z at ry = 0. */
const facing = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);

export const SEAT_OFFSET_2 = 0.9;
export const SEAT_OFFSET_4 = 0.95;
export const TABLE_RADIUS_2 = 1.2;
export const TABLE_RADIUS_4 = 1.35;

/** A round table for 2 (seats east and west) or 4 (seats on all four sides). */
export function roundTable(id: string, x: number, z: number, seats: 2 | 4): TableDef {
  const d = seats === 2 ? SEAT_OFFSET_2 : SEAT_OFFSET_4;
  const spots: Vec2[] =
    seats === 2
      ? [
          { x: x - d, z },
          { x: x + d, z },
        ]
      : [
          { x, z: z - d },
          { x: x + d, z },
          { x, z: z + d },
          { x: x - d, z },
        ];
  return {
    id,
    shape: "round",
    x,
    z,
    seats: spots.map((s) => ({ x: s.x, z: s.z, ry: facing(s.x, s.z, x, z) })),
    obstacle: { kind: "circle", label: "table", x, z, r: seats === 2 ? TABLE_RADIUS_2 : TABLE_RADIUS_4 },
  };
}

export const ROOM_TABLE_Z = -0.5;
/** Id of every room's long table. A room's meeting (call and presentations) is the guests seated there (M20). */
export const ROOM_TABLE_ID = "long";
const LONG_SEAT_SPACING = 1.25;

/**
 * The long table in every room, with one chair per guest the room holds (2–8).
 * Chairs alternate south, north so the owner's first guests sit facing each other.
 */
export function longTable(capacity: number): TableDef {
  const n = Math.max(2, Math.min(8, Math.round(capacity)));
  const perSide = Math.ceil(n / 2);
  const width = Math.max(2.2, perSide * LONG_SEAT_SPACING);
  const depth = 1.3;
  const z = ROOM_TABLE_Z;
  const seats: SeatDef[] = [];
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? 1 : -1; // south (+z) first
    const col = Math.floor(i / 2);
    const count = side === 1 ? Math.ceil(n / 2) : Math.floor(n / 2);
    const x = (col - (count - 1) / 2) * LONG_SEAT_SPACING;
    const sz = z + side * (depth / 2 + 0.45);
    seats.push({ x, z: sz, ry: side === 1 ? Math.PI : 0 });
  }
  return {
    id: ROOM_TABLE_ID,
    shape: "long",
    x: 0,
    z,
    seats,
    width,
    depth,
    obstacle: { kind: "box", label: "table", minX: -width / 2 - 0.3, maxX: width / 2 + 0.3, minZ: z - depth / 2 - 0.6, maxZ: z + depth / 2 + 0.6 },
  };
}

/** Tables on each floor (1 lobby … 5 rooftop). Positions are checked by unit tests. */
export const FLOOR_TABLES: Record<1 | 2 | 3 | 4 | 5, readonly TableDef[]> = {
  1: [roundTable("t1", -7.1, 6.6, 4), roundTable("t2", 7.1, 6.6, 4), roundTable("t3", -4.2, 4.4, 2), roundTable("t4", 4.2, 4.4, 2)],
  2: [roundTable("t1", -15.2, 2.6, 4), roundTable("t2", 15.2, 2.6, 4), roundTable("t3", -9.2, 2.5, 2), roundTable("t4", 9.2, 2.5, 2)],
  3: [roundTable("t1", -4, 5.2, 4), roundTable("t2", 4, 5.2, 4), roundTable("t3", -9.6, 0, 2), roundTable("t4", 9.6, 0, 2)],
  4: [
    roundTable("t1", -10, -3.5, 4),
    roundTable("t2", -3.5, -3.5, 4),
    roundTable("t3", 3.5, -3.5, 4),
    roundTable("t4", 10, -3.5, 4),
    roundTable("t5", -10, 3.5, 4),
    roundTable("t6", 10, 3.5, 4),
    roundTable("t7", -3.5, 3.5, 2),
    roundTable("t8", 3.5, 3.5, 2),
    roundTable("t9", -11, 8.6, 2),
    roundTable("t10", -5.5, 8.6, 2),
    roundTable("t11", 0, 8.6, 2),
    roundTable("t12", 5.5, 8.6, 2),
    roundTable("t13", 11, 8.6, 2),
  ],
  5: [roundTable("t1", 3.5, 6.5, 4), roundTable("t2", -2.5, 8.2, 2), roundTable("t3", 4.5, -4.5, 2)],
};

export const tableObstacles = (tables: readonly TableDef[]): Obstacle[] => tables.map((t) => t.obstacle);

// ---- seats ----

/** The server lets a guest sit when its own position for them is this close to the chair. */
export const SEAT_REACH = 2.4;
const SEAT_ZONE_R_ROUND = 0.8;
const SEAT_ZONE_R_LONG = 0.62;

const longTables = new Map<number, TableDef>();
/** Cached so every caller (layouts, prompts, server) shares one object per capacity. */
export function roomTable(capacity: number): TableDef {
  const n = Math.max(2, Math.min(8, Math.round(capacity)));
  let t = longTables.get(n);
  if (!t) {
    t = longTable(n);
    longTables.set(n, t);
  }
  return t;
}

/** Tables in a scene: the floor's tables, or the long table of a room. */
export function tablesFor(place: Place): readonly TableDef[] {
  if (place.kind === "lobby") return FLOOR_TABLES[1];
  if (place.kind === "floor") return FLOOR_TABLES[place.floor];
  return [roomTable(place.room.capacity)];
}

export function findSeat(place: Place, table: string, seat: number): { table: TableDef; seat: SeatDef } | null {
  const t = tablesFor(place).find((x) => x.id === table);
  const s = t?.seats[seat];
  return t && s ? { table: t, seat: s } : null;
}

/** Unit vector from the table towards a chair (long tables: straight out of their side). */
function outward(table: TableDef, seat: SeatDef): Vec2 {
  if (table.shape === "long") return { x: 0, z: seat.z > table.z ? 1 : -1 };
  const dx = seat.x - table.x;
  const dz = seat.z - table.z;
  const len = Math.hypot(dx, dz) || 1;
  return { x: dx / len, z: dz / len };
}

/** Where a guest stands to sit down, and where they are put when they stand up: just outside the chair. */
export function standSpot(table: TableDef, seat: SeatDef): Vec2 {
  const o = outward(table, seat);
  if (table.obstacle.kind === "circle") {
    const d = table.obstacle.r + 0.55;
    return { x: table.x + o.x * d, z: table.z + o.z * d };
  }
  const edge = o.z > 0 ? table.obstacle.maxZ : table.obstacle.minZ;
  return { x: seat.x, z: edge + o.z * 0.55 };
}

export const seatCode = (table: string, seat: number) => `${table}:${seat}`;

export function parseSeatCode(code: string): { table: string; seat: number } | null {
  const m = /^([a-z0-9]{1,12}):(\d)$/.exec(code);
  return m ? { table: m[1] as string, seat: Number(m[2]) } : null;
}

/** One prompt per chair, just outside it. */
export function seatZones(tables: readonly TableDef[]): PromptZone[] {
  return tables.flatMap((t) =>
    t.seats.map((s, i) => ({ kind: "seat" as const, code: seatCode(t.id, i), r: t.shape === "long" ? SEAT_ZONE_R_LONG : SEAT_ZONE_R_ROUND, ...standSpot(t, s) })),
  );
}
