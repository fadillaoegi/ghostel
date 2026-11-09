import { describe, expect, it } from "vitest";
import {
  CANDIES,
  COUNTER_SPOT,
  ELEVATORS,
  FLOOR_LAYOUTS,
  FLOOR_NPCS,
  FLOOR_TABLES,
  LOBBY_LAYOUT,
  PLAYER_RADIUS,
  SNACKS,
  SEAT_REACH,
  constrainToWorld,
  findSeat,
  isSnackId,
  layoutForPlace,
  parseSeatCode,
  seatCode,
  standSpot,
  tablesFor,
  type TableDef,
  longTable,
  parseClientMessage,
  promptZones,
  roundTable,
  snackName,
  type FloorNumber,
  type Layout,
  type Vec2,
} from "../src/index";

const layoutOf = (floor: FloorNumber): Layout => (floor === 1 ? LOBBY_LAYOUT : FLOOR_LAYOUTS[floor]);
const walkable = (p: Vec2, layout: Layout) => {
  const q = constrainToWorld(p, layout);
  return Math.hypot(q.x - p.x, q.z - p.z) < 1e-6;
};
const FLOORS = [1, 2, 3, 4, 5] as const;

describe("tables", () => {
  it("round tables seat 2 or 4 guests facing the centre", () => {
    const two = roundTable("a", 0, 0, 2);
    expect(two.seats).toHaveLength(2);
    const four = roundTable("b", 3, -2, 4);
    expect(four.seats).toHaveLength(4);
    for (const s of four.seats) {
      // Looking along ry from the seat points at the table centre.
      const ahead = { x: s.x + Math.sin(s.ry), z: s.z + Math.cos(s.ry) };
      expect(Math.hypot(ahead.x - 3, ahead.z + 2)).toBeLessThan(Math.hypot(s.x - 3, s.z + 2));
    }
  });

  it("every floor has tables for 2 and 4, the Diner has the most, ids are unique per floor", () => {
    for (const floor of FLOORS) {
      const tables = FLOOR_TABLES[floor];
      expect(new Set(tables.map((t) => t.id)).size).toBe(tables.length);
      expect(tables.some((t) => t.seats.length === 2)).toBe(true);
      expect(tables.some((t) => t.seats.length === 4)).toBe(true);
    }
    const counts = FLOORS.map((f) => FLOOR_TABLES[f].length);
    expect(Math.max(...counts)).toBe(FLOOR_TABLES[4].length);
    expect(FLOOR_TABLES[4].length).toBeGreaterThanOrEqual(10);
  });

  it("tables are inside the walls, apart from each other, and block walking", () => {
    for (const floor of FLOORS) {
      const layout = layoutOf(floor);
      const b = layout.bounds;
      const tables = FLOOR_TABLES[floor];
      for (const t of tables) {
        if (t.obstacle.kind !== "circle") throw new Error("round tables use circles");
        const r = t.obstacle.r;
        // Room to walk between the table and the walls.
        expect(t.x - r - b.minX, `${floor}/${t.id} west`).toBeGreaterThanOrEqual(2 * PLAYER_RADIUS);
        expect(b.maxX - (t.x + r), `${floor}/${t.id} east`).toBeGreaterThanOrEqual(2 * PLAYER_RADIUS);
        expect(t.z - r - b.minZ, `${floor}/${t.id} north`).toBeGreaterThanOrEqual(2 * PLAYER_RADIUS);
        expect(b.maxZ - (t.z + r), `${floor}/${t.id} south`).toBeGreaterThanOrEqual(2 * PLAYER_RADIUS);
        expect(walkable({ x: t.x, z: t.z }, layout)).toBe(false);
        // A gap narrower than a guest between two obstacles would trap the push-out logic.
        for (const o of layout.obstacles) {
          if (o === t.obstacle) continue;
          const gap =
            o.kind === "circle"
              ? Math.hypot(t.x - o.x, t.z - o.z) - r - o.r
              : Math.hypot(Math.max(o.minX - t.x, 0, t.x - o.maxX), Math.max(o.minZ - t.z, 0, t.z - o.maxZ)) - r;
          expect(gap, `${floor}/${t.id} vs ${o.label}`).toBeGreaterThanOrEqual(2 * PLAYER_RADIUS);
        }
      }
    }
  });

  it("candies, elevator arrivals and prompt zones stay reachable around the tables", () => {
    for (const c of CANDIES) expect(walkable({ x: c.x, z: c.z }, layoutOf(c.floor)), c.id).toBe(true);
    for (const floor of FLOORS) {
      const layout = layoutOf(floor);
      expect(walkable(ELEVATORS[floor].arrive(() => 0.5), layout)).toBe(true);
      const place = floor === 1 ? ({ kind: "lobby" } as const) : ({ kind: "floor", floor } as const);
      for (const zone of promptZones(place)) {
        // Some point of every zone can be stood on.
        let reachable = false;
        for (let a = 0; a < Math.PI * 2 && !reachable; a += Math.PI / 12) {
          for (const d of [0, zone.r * 0.5, zone.r * 0.9]) {
            if (walkable({ x: zone.x + Math.cos(a) * d, z: zone.z + Math.sin(a) * d }, layout)) reachable = true;
          }
        }
        expect(reachable, `${floor}/${zone.code ?? zone.kind}`).toBe(true);
      }
    }
  });

  it("long room tables have one seat per guest the room holds", () => {
    for (let n = 2; n <= 8; n++) {
      const t = longTable(n);
      expect(t.seats).toHaveLength(n);
      const south = t.seats.filter((s) => s.z > t.z).length;
      expect(south - (n - south)).toBeGreaterThanOrEqual(0);
      expect(south - (n - south)).toBeLessThanOrEqual(1);
    }
    expect(longTable(1).seats).toHaveLength(2);
    expect(longTable(20).seats).toHaveLength(8);
  });
});

describe("seats", () => {
  const room = (capacity: number) => ({ kind: "room", owner: false, room: { id: "r", name: "Room", ownerName: "O", access: "open", decor: "crypt", game: "none", floor: 1, slot: "A", capacity } }) as const;

  it("every chair on every floor has a walkable spot to sit down from, within reach", () => {
    for (const floor of FLOORS) {
      const place = floor === 1 ? ({ kind: "lobby" } as const) : ({ kind: "floor", floor } as const);
      const layout = layoutOf(floor);
      for (const t of tablesFor(place)) {
        t.seats.forEach((s, i) => {
          const spot = standSpot(t, s);
          expect(walkable(spot, layout), `${floor}/${t.id}:${i}`).toBe(true);
          expect(Math.hypot(spot.x - s.x, spot.z - s.z)).toBeLessThan(SEAT_REACH);
        });
      }
    }
  });

  it("rooms of every size have a long table with reachable chairs and a walkable entrance", () => {
    for (let n = 2; n <= 8; n++) {
      const place = room(n);
      const layout = layoutForPlace(place);
      const [table] = tablesFor(place);
      expect(table?.seats).toHaveLength(n);
      for (const s of table?.seats ?? []) expect(walkable(standSpot(table as TableDef, s), layout)).toBe(true);
      for (let i = 0; i <= 10; i++) expect(walkable(layout.spawn(() => i / 10), layout)).toBe(true);
      expect(promptZones(place).filter((z) => z.kind === "seat")).toHaveLength(n);
      expect(findSeat(place, "long", n - 1)).not.toBeNull();
      expect(findSeat(place, "long", n)).toBeNull();
    }
  });

  it("seat codes round-trip and reject junk", () => {
    expect(parseSeatCode(seatCode("t12", 3))).toEqual({ table: "t12", seat: 3 });
    expect(parseSeatCode("long:7")).toEqual({ table: "long", seat: 7 });
    expect(parseSeatCode("t1:x")).toBeNull();
    expect(parseSeatCode("<b>:1")).toBeNull();
  });
});

describe("Ghoul's Diner", () => {
  it("has a menu of known snacks", () => {
    expect(SNACKS.length).toBeGreaterThanOrEqual(5);
    expect(isSnackId("pumpkin_pie")).toBe(true);
    expect(isSnackId("garlic_bread")).toBe(false);
    expect(isSnackId(3)).toBe(false);
    expect(snackName("worm_noodles")).toBe("Worm Noodles");
  });

  it("the counter spot can be stood on and the cook stays behind the counter", () => {
    expect(walkable(COUNTER_SPOT, FLOOR_LAYOUTS[4])).toBe(true);
    const chef = FLOOR_NPCS[4].find((n) => n.id === "chef");
    for (let t = 0; t < 300; t += 0.5) expect(chef?.pose(t).z).toBeLessThan(-8.6);
  });

  it("the waiter walks the aisle without crossing tables", () => {
    const waiter = FLOOR_NPCS[4].find((n) => n.id === "crumbs");
    for (let t = 0; t < 600; t += 0.5) {
      const p = waiter?.pose(t) as Vec2;
      for (const table of FLOOR_TABLES[4]) {
        if (table.obstacle.kind !== "circle") continue;
        expect(Math.hypot(p.x - table.x, p.z - table.z), `t=${t} ${table.id}`).toBeGreaterThan(table.obstacle.r + 0.3);
      }
    }
  });

  it("parses order messages", () => {
    expect(parseClientMessage('{"t":"order","snack":"pumpkin_pie"}')).toEqual({ ok: true, msg: { t: "order", snack: "pumpkin_pie" } });
    expect(parseClientMessage('{"t":"order"}')).toEqual({ ok: false, reason: "bad_shape" });
    expect(parseClientMessage('{"t":"order","snack":"pumpkin_pie","x":1}')).toEqual({ ok: false, reason: "bad_shape" });
  });
});
