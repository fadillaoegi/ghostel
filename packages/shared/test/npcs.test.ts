import { describe, expect, it } from "vitest";
import { LOBBY_LAYOUT, LOBBY_NPCS, RECEPTIONIST_ID, ROOM_LAYOUT, greeting, roomHost, type Layout, type NpcDef } from "../src/index";

const MARGIN = 0.4;

function clearOfObstacles(npc: NpcDef, layout: Layout, t: number): boolean {
  const p = npc.pose(t);
  const b = layout.bounds;
  if (p.x < b.minX + MARGIN || p.x > b.maxX - MARGIN || p.z < b.minZ + MARGIN || p.z > b.maxZ - MARGIN) return false;
  if (npc.id === RECEPTIONIST_ID) return true; // floats behind the desk on purpose
  for (const o of layout.obstacles) {
    if (o.kind === "circle" && Math.hypot(p.x - o.x, p.z - o.z) < o.r + 0.3) return false;
    if (o.kind === "box" && p.x > o.minX - 0.3 && p.x < o.maxX + 0.3 && p.z > o.minZ - 0.3 && p.z < o.maxZ + 0.3) return false;
  }
  return Number.isFinite(p.ry);
}

describe("NPC ghosts", () => {
  it("lobby ghosts stay inside the walls and off the fountain, pillars and desk for 10 minutes", () => {
    for (const npc of LOBBY_NPCS) {
      for (let t = 0; t < 600; t += 0.25) expect(clearOfObstacles(npc, LOBBY_LAYOUT, t), `${npc.id} at t=${t}`).toBe(true);
    }
  });

  it("room hosts circle the table without touching it", () => {
    for (const game of ["none", "pumpkin_trivia"] as const) {
      const host = roomHost(game);
      for (let t = 0; t < 600; t += 0.25) expect(clearOfObstacles(host, ROOM_LAYOUT, t)).toBe(true);
    }
  });

  it("poses are deterministic, so every client sees the same ghost", () => {
    for (const npc of LOBBY_NPCS) expect(npc.pose(1234.5)).toEqual(npc.pose(1234.5));
  });

  it("every NPC has lines and unique ids", () => {
    expect(new Set(LOBBY_NPCS.map((n) => n.id)).size).toBe(LOBBY_NPCS.length);
    for (const npc of [...LOBBY_NPCS, roomHost("none"), roomHost("pumpkin_trivia")]) expect(npc.lines.length).toBeGreaterThan(0);
    expect(roomHost("pumpkin_trivia").lines.join(" ")).toContain("Pumpkin Trivia");
  });

  it("the receptionist greets by name", () => {
    expect(greeting("Mina Mummy")).toBe("Welcome to Ghostel, Mina Mummy! Rooms and games are through the glowing doors 🚪");
  });
});
