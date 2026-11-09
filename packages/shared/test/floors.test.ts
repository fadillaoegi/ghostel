import { describe, expect, it } from "vitest";
import {
  CANDIES,
  CROWN_CANDIES,
  ELEVATORS,
  FLOORS,
  FLOOR_LAYOUTS,
  FLOOR_NPCS,
  FLOOR_TALKERS,
  LOBBY_LAYOUT,
  PLAYER_RADIUS,
  cleanCandies,
  constrainToWorld,
  crownUnlocked,
  layoutForPlace,
  parseClientMessage,
  promptZones,
  sceneKeyFor,
  type FloorNumber,
  type Layout,
  type Vec2,
} from "../src/index";

const layoutOf = (floor: FloorNumber): Layout => (floor === 1 ? LOBBY_LAYOUT : FLOOR_LAYOUTS[floor]);
const walkable = (p: Vec2, layout: Layout) => {
  const q = constrainToWorld(p, layout);
  return Math.hypot(q.x - p.x, q.z - p.z) < 1e-6;
};

describe("floors", () => {
  it("has five floors with names", () => {
    expect(FLOORS.map((f) => f.floor)).toEqual([1, 2, 3, 4, 5]);
    expect(FLOORS.map((f) => f.name)).toEqual(["Grand Lobby", "Hall of Portraits", "Moonlit Greenhouse", "Ghoul's Diner", "Rooftop Graveyard"]);
  });

  it("elevator arrival spots are walkable on every floor", () => {
    for (const floor of [1, 2, 3, 4, 5] as const) {
      for (let i = 0; i <= 10; i++) expect(walkable(ELEVATORS[floor].arrive(() => i / 10), layoutOf(floor)), `floor ${floor}`).toBe(true);
    }
  });

  it("guests arriving by elevator stand inside its prompt zone", () => {
    for (const floor of [1, 2, 3, 4, 5] as const) {
      const place = floor === 1 ? ({ kind: "lobby" } as const) : ({ kind: "floor", floor } as const);
      const zone = promptZones(place).find((z) => z.kind === "elevator");
      const spot = ELEVATORS[floor].arrive(() => 0.5);
      expect(zone && Math.hypot(spot.x - zone.x, spot.z - zone.z) < zone.r).toBe(true);
    }
  });

  it("floor layouts keep players inside the walls (grid sweep)", () => {
    for (const floor of [2, 3, 4, 5] as const) {
      const layout = FLOOR_LAYOUTS[floor];
      for (let x = -22; x <= 22; x += 0.61) {
        for (let z = -14; z <= 14; z += 0.59) {
          const p = constrainToWorld({ x, z }, layout);
          expect(p.x).toBeGreaterThanOrEqual(layout.bounds.minX + PLAYER_RADIUS - 1e-6);
          expect(p.x).toBeLessThanOrEqual(layout.bounds.maxX - PLAYER_RADIUS + 1e-6);
          expect(p.z).toBeGreaterThanOrEqual(layout.bounds.minZ + PLAYER_RADIUS - 1e-6);
          expect(p.z).toBeLessThanOrEqual(layout.bounds.maxZ - PLAYER_RADIUS + 1e-6);
        }
      }
    }
  });

  it("maps places to layouts and scene keys", () => {
    expect(sceneKeyFor({ kind: "lobby" })).toBe("lobby");
    expect(sceneKeyFor({ kind: "floor", floor: 3 })).toBe("floor:3");
    expect(layoutForPlace({ kind: "floor", floor: 2 })).toBe(FLOOR_LAYOUTS[2]);
    const kinds = (floor: 2 | 4 | 5) => promptZones({ kind: "floor", floor }).filter((z) => z.kind !== "seat").map((z) => z.code ?? z.kind);
    expect(kinds(2)).toEqual(["2A", "2B", "2C", "2D", "2E", "2F", "elevator", "mirror"]);
    expect(kinds(4)).toEqual(["elevator", "counter"]);
    expect(kinds(5)).toEqual(["elevator"]);
    // One seat prompt per chair.
    expect(promptZones({ kind: "floor", floor: 2 }).filter((z) => z.kind === "seat")).toHaveLength(12);
  });

  it("floor NPCs and talkers stay inside the walls", () => {
    for (const floor of [2, 3, 4, 5] as const) {
      const b = FLOOR_LAYOUTS[floor].bounds;
      for (const npc of FLOOR_NPCS[floor]) {
        for (let t = 0; t < 600; t += 0.5) {
          const p = npc.pose(t);
          expect(p.x > b.minX + 0.4 && p.x < b.maxX - 0.4 && p.z > b.minZ + 0.4 && p.z < b.maxZ - 0.4, `${npc.id} t=${t}`).toBe(true);
        }
      }
      for (const talker of FLOOR_TALKERS[floor]) expect(walkable({ x: talker.x, z: talker.z }, FLOOR_LAYOUTS[floor])).toBe(true);
    }
    expect(FLOOR_TALKERS[5].every((t) => t.lines.length === 1)).toBe(true);
  });
});

describe("candies", () => {
  it("has 12 unique candies, three per floor except the Diner, all walkable", () => {
    expect(CANDIES).toHaveLength(12);
    expect(CROWN_CANDIES).toBe(12);
    expect(new Set(CANDIES.map((c) => c.id)).size).toBe(12);
    for (const floor of [1, 2, 3, 5] as const) expect(CANDIES.filter((c) => c.floor === floor)).toHaveLength(3);
    expect(CANDIES.filter((c) => c.floor === 4)).toHaveLength(0);
    // Ids survive the rooftop's move to floor 5, so nobody loses progress.
    expect(CANDIES.filter((c) => c.id.startsWith("rooftop-")).every((c) => c.floor === 5)).toBe(true);
    for (const c of CANDIES) expect(walkable({ x: c.x, z: c.z }, layoutOf(c.floor)), c.id).toBe(true);
  });

  it("the crown unlocks only with every real candy", () => {
    const all = CANDIES.map((c) => c.id);
    expect(crownUnlocked(all)).toBe(true);
    expect(crownUnlocked(all.slice(1))).toBe(false);
    expect(crownUnlocked([...all.slice(1), "fake-candy", "fake-2"])).toBe(false);
    expect(crownUnlocked([...all.slice(1), all[1] as string])).toBe(false); // duplicates don't count
    expect(cleanCandies(["lobby-west", "lobby-west", "nope", 3])).toEqual(["lobby-west"]);
  });

  it("parses floor and collect messages", () => {
    expect(parseClientMessage('{"t":"floor","floor":3}')).toEqual({ ok: true, msg: { t: "floor", floor: 3 } });
    expect(parseClientMessage('{"t":"floor","floor":5}')).toEqual({ ok: true, msg: { t: "floor", floor: 5 } });
    expect(parseClientMessage('{"t":"floor","floor":6}')).toEqual({ ok: false, reason: "bad_shape" });
    expect(parseClientMessage('{"t":"collect","candy":"lobby-west"}')).toMatchObject({ ok: true });
    expect(parseClientMessage('{"t":"collect","candy":"lobby-west","x":0}')).toEqual({ ok: false, reason: "bad_shape" });
  });
});
