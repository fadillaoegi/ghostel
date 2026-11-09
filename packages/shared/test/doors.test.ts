import { describe, expect, it } from "vitest";
import {
  DOORS,
  DOOR_SLOTS,
  ELEVATORS,
  FLOOR_LAYOUTS,
  GALLERY_MIRROR,
  GALLERY_PORTRAITS,
  LOBBY_LAYOUT,
  constrainToWorld,
  doorArrival,
  doorsOnFloor,
  findDoor,
  inFrontOf,
  parseRoomInput,
  type Layout,
} from "../src/index";

const layoutOf = (floor: number): Layout => (floor === 1 ? LOBBY_LAYOUT : FLOOR_LAYOUTS[floor as 2 | 3]);

describe("room doors", () => {
  it("has 4 + 6 + 4 doors with unique codes", () => {
    expect(DOORS.map((d) => d.code)).toEqual(["1A", "1B", "1C", "1D", "2A", "2B", "2C", "2D", "2E", "2F", "3A", "3B", "3C", "3D"]);
    for (const floor of [1, 2, 3] as const) expect(doorsOnFloor(floor).map((d) => d.slot)).toEqual(DOOR_SLOTS[floor]);
    expect(findDoor(2, "B")?.code).toBe("2B");
    expect(findDoor(4, "A")).toBeUndefined();
  });

  it("the spot in front of every door is walkable (prompt zone and arrival)", () => {
    for (const d of DOORS) {
      for (const p of [inFrontOf(d, 0.9), doorArrival(d)]) {
        const q = constrainToWorld(p, layoutOf(d.floor));
        expect(Math.hypot(q.x - p.x, q.z - p.z), d.code).toBeLessThan(1e-6);
      }
    }
  });

  it("doors on a wall never overlap portraits, elevators or the mirror", () => {
    const north2 = [...GALLERY_PORTRAITS, ELEVATORS[2].door.x, GALLERY_MIRROR.x];
    for (const d of doorsOnFloor(2)) for (const x of north2) expect(Math.abs(d.x - x), d.code).toBeGreaterThanOrEqual(2);
    for (const d of doorsOnFloor(3)) expect(Math.abs(d.x - ELEVATORS[3].door.x), d.code).toBeGreaterThanOrEqual(2.5);
    for (const a of DOORS) for (const b of DOORS) if (a !== b && a.floor === b.floor) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(2);
  });

  it("validates floor and slot on create, and refuses moving a room", () => {
    const base = { name: "Den", access: "open", decor: "crypt", game: "none" };
    expect(parseRoomInput({ ...base, floor: 2, slot: "F" }, "create")).toMatchObject({ ok: true, value: { floor: 2, slot: "F" } });
    expect(parseRoomInput({ ...base, floor: 3, slot: "E" }, "create")).toMatchObject({ ok: false, field: "slot", message: "Floor 3 has doors A, B, C, D." });
    expect(parseRoomInput({ ...base, floor: 4 }, "create")).toMatchObject({ ok: false, field: "floor" });
    expect(parseRoomInput({ ...base, slot: "A" }, "create")).toMatchObject({ ok: false, field: "slot" });
    expect(parseRoomInput({ floor: 2 }, "update")).toMatchObject({ ok: false, field: "floor" });
  });
});
