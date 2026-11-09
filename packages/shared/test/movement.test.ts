import { describe, expect, it } from "vitest";
import {
  LOBBY_BOUNDS,
  LOBBY_OBSTACLES,
  MAX_SPEED,
  MOVE_BUDGET_CAP,
  PLAYER_RADIUS,
  constrainToWorld,
  initialMoveState,
  normalizeAngle,
  resolveMove,
  spawnPoint,
  type Vec2,
} from "../src/index";

function insideWorld(p: Vec2): boolean {
  const b = LOBBY_BOUNDS;
  const r = PLAYER_RADIUS - 1e-6;
  if (p.x < b.minX + r || p.x > b.maxX - r || p.z < b.minZ + r || p.z > b.maxZ - r) return false;
  for (const o of LOBBY_OBSTACLES) {
    if (o.kind === "circle" && Math.hypot(p.x - o.x, p.z - o.z) < o.r + r) return false;
    if (o.kind === "box") {
      const cx = Math.min(o.maxX, Math.max(o.minX, p.x));
      const cz = Math.min(o.maxZ, Math.max(o.minZ, p.z));
      if (Math.hypot(p.x - cx, p.z - cz) < r) return false;
    }
  }
  return true;
}

describe("constrainToWorld", () => {
  it("clamps positions outside the building to the walls", () => {
    expect(constrainToWorld({ x: 999, z: -999 })).toEqual({ x: 14 - PLAYER_RADIUS, z: -10 + PLAYER_RADIUS });
  });

  it("pushes players out of the fountain, pillars and reception desk", () => {
    expect(insideWorld(constrainToWorld({ x: 0.1, z: 0.1 }))).toBe(true);
    expect(insideWorld(constrainToWorld({ x: 0, z: 0 }))).toBe(true);
    expect(insideWorld(constrainToWorld({ x: -10, z: 6 }))).toBe(true);
    expect(insideWorld(constrainToWorld({ x: 0, z: -8.5 }))).toBe(true);
  });

  it("never returns a point inside an obstacle or outside the walls (grid sweep)", () => {
    for (let x = -20; x <= 20; x += 0.37) {
      for (let z = -15; z <= 15; z += 0.41) {
        expect(insideWorld(constrainToWorld({ x, z }))).toBe(true);
      }
    }
  });

  it("spawn points are walkable", () => {
    for (let i = 0; i <= 10; i++) {
      const p = spawnPoint(() => i / 10);
      expect(constrainToWorld(p)).toEqual(p);
    }
  });
});

describe("resolveMove", () => {
  const start = { x: 0, z: 6 };

  it("accepts a normal walking step unchanged", () => {
    const r = resolveMove(initialMoveState(start), { x: 0.2, z: 6 }, 0.05);
    expect(r.corrected).toBe(false);
    expect(r.pos).toEqual({ x: 0.2, z: 6 });
  });

  it("limits a teleport to the movement budget and flags a correction", () => {
    const r = resolveMove(initialMoveState(start), { x: 12, z: 6 }, 0.05);
    expect(r.corrected).toBe(true);
    expect(r.pos.x).toBeCloseTo(MOVE_BUDGET_CAP, 5);
    expect(r.budget).toBeCloseTo(0, 5);
  });

  it("keeps sustained speed at or below MAX_SPEED even with many fast messages", () => {
    let state = initialMoveState({ x: -12, z: 6 });
    const dt = 0.01;
    const steps = 300; // 3 seconds of a cheating client spamming +1 unit per message
    for (let i = 0; i < steps; i++) state = resolveMove(state, { x: state.pos.x + 1, z: 6 }, dt);
    const travelled = state.pos.x + 12;
    expect(travelled).toBeLessThanOrEqual(MOVE_BUDGET_CAP + MAX_SPEED * dt * steps + 1e-6);
  });

  it("rejects fake out-of-bounds positions", () => {
    let state = initialMoveState({ x: 13, z: 9 });
    for (let i = 0; i < 50; i++) {
      state = resolveMove(state, { x: 1e4, z: 1e4 }, 1);
      expect(insideWorld(state.pos)).toBe(true);
    }
    expect(state.pos).toEqual({ x: 14 - PLAYER_RADIUS, z: 10 - PLAYER_RADIUS });
  });

  it("rejects NaN and Infinity without moving", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const r = resolveMove(initialMoveState(start), { x: bad, z: 6 }, 0.05);
      expect(r).toMatchObject({ pos: start, corrected: true });
    }
  });

  it("treats negative or non-finite dt as zero", () => {
    const r = resolveMove({ pos: start, budget: 0 }, { x: 1, z: 6 }, -5);
    expect(r.pos).toEqual(start);
    const r2 = resolveMove({ pos: start, budget: 0 }, { x: 1, z: 6 }, Number.NaN);
    expect(r2.pos).toEqual(start);
  });
});

describe("normalizeAngle", () => {
  it("wraps into (−π, π]", () => {
    expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI);
    expect(normalizeAngle(-Math.PI * 3)).toBeCloseTo(Math.PI);
    expect(normalizeAngle(0.5)).toBe(0.5);
    expect(normalizeAngle(Number.NaN)).toBe(0);
  });
});
