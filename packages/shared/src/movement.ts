import { LOBBY_LAYOUT, PLAYER_RADIUS, type Bounds, type Layout, type Obstacle, type Vec2 } from "./layout";

/** Speed the client walks at. */
export const WALK_SPEED = 4;
/** Highest sustained speed the server accepts (gives headroom over WALK_SPEED for jitter). */
export const MAX_SPEED = 5;
/** Largest distance a burst of moves may cover at once (absorbs bunched packets). */
export const MOVE_BUDGET_CAP = 2.5;

const EPSILON = 1e-3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampToBounds(p: Vec2, bounds: Bounds, radius: number): Vec2 {
  return {
    x: clamp(p.x, bounds.minX + radius, bounds.maxX - radius),
    z: clamp(p.z, bounds.minZ + radius, bounds.maxZ - radius),
  };
}

function pushOut(p: Vec2, o: Obstacle, radius: number): Vec2 {
  if (o.kind === "circle") {
    const dx = p.x - o.x;
    const dz = p.z - o.z;
    const min = o.r + radius;
    const dist = Math.hypot(dx, dz);
    if (dist >= min) return p;
    if (dist < EPSILON) return { x: o.x, z: o.z + min }; // dead centre: push south
    return { x: o.x + (dx / dist) * min, z: o.z + (dz / dist) * min };
  }
  // Circle vs axis-aligned box.
  const cx = clamp(p.x, o.minX, o.maxX);
  const cz = clamp(p.z, o.minZ, o.maxZ);
  const dx = p.x - cx;
  const dz = p.z - cz;
  const dist = Math.hypot(dx, dz);
  if (dist >= radius) return p;
  if (dist > EPSILON) return { x: cx + (dx / dist) * radius, z: cz + (dz / dist) * radius };
  // Centre is inside the box: leave through the nearest side.
  const exits: Vec2[] = [
    { x: o.minX - radius, z: p.z },
    { x: o.maxX + radius, z: p.z },
    { x: p.x, z: o.minZ - radius },
    { x: p.x, z: o.maxZ + radius },
  ];
  let best = exits[0] as Vec2;
  for (const e of exits) {
    if (Math.hypot(e.x - p.x, e.z - p.z) < Math.hypot(best.x - p.x, best.z - p.z)) best = e;
  }
  return best;
}

/** Keeps a point inside the scene's walls and outside every obstacle. */
export function constrainToWorld(p: Vec2, layout: Layout = LOBBY_LAYOUT, radius: number = PLAYER_RADIUS): Vec2 {
  let q = clampToBounds(p, layout.bounds, radius);
  for (let i = 0; i < 3; i++) {
    for (const o of layout.obstacles) q = pushOut(q, o, radius);
    q = clampToBounds(q, layout.bounds, radius);
  }
  return q;
}

export interface MoveState {
  pos: Vec2;
  /** Distance the player may still travel right now; refills at MAX_SPEED. */
  budget: number;
}

export interface MoveResult extends MoveState {
  /** True when the accepted position differs from what the client asked for. */
  corrected: boolean;
}

export function initialMoveState(pos: Vec2): MoveState {
  return { pos, budget: MOVE_BUDGET_CAP };
}

/**
 * Server-authoritative movement step. `dtSeconds` is the time since the previous
 * accepted move. Non-finite targets are rejected; long steps are shortened to the
 * remaining budget; the result is constrained to the world.
 */
export function resolveMove(state: MoveState, target: Vec2, dtSeconds: number, layout: Layout = LOBBY_LAYOUT): MoveResult {
  const dt = Number.isFinite(dtSeconds) && dtSeconds > 0 ? dtSeconds : 0;
  const budget = Math.min(MOVE_BUDGET_CAP, state.budget + MAX_SPEED * dt);
  if (!Number.isFinite(target.x) || !Number.isFinite(target.z)) {
    return { pos: state.pos, budget, corrected: true };
  }
  const dx = target.x - state.pos.x;
  const dz = target.z - state.pos.z;
  const dist = Math.hypot(dx, dz);
  const step = Math.min(dist, budget);
  const moved = dist > EPSILON ? { x: state.pos.x + (dx / dist) * step, z: state.pos.z + (dz / dist) * step } : state.pos;
  const pos = constrainToWorld(moved, layout);
  const corrected = Math.hypot(pos.x - target.x, pos.z - target.z) > EPSILON;
  return { pos, budget: budget - step, corrected };
}

/** Wraps an angle to (−π, π]; non-finite values become 0. */
export function normalizeAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 0;
  const tau = Math.PI * 2;
  let a = angle % tau;
  if (a <= -Math.PI) a += tau;
  if (a > Math.PI) a -= tau;
  return a;
}
