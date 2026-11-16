import { useMemo } from "react";
import * as THREE from "three";
import { FPS, INTRO, OUTRO } from "../timeline";
import { easeInOutCubic, progress, seeded } from "./random";
import { PUMPKIN_CENTRE, PUMPKIN_SCALE } from "./Pumpkin";
import { signPoints, type Vec3 } from "./textPoints";
import { PALETTE } from "./textures";

export const SHARD_COUNT = 420;

interface Shard {
  start: Vec3;
  dir: Vec3;
  speed: number;
  axis: Vec3;
  spin: number;
  size: number;
  colour: 0 | 1 | 2;
  target: Vec3;
  /** Perpendicular to the flight, for the swirl. */
  side: Vec3;
}

function unit(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function makeShards(seed: number): Shard[] {
  const rng = seeded(seed);
  const targets = signPoints(SHARD_COUNT, seed + 1);
  return targets.map((target) => {
    // A random direction, flattened a little so most shards fly sideways and up, toward the camera.
    const dir = unit([rng() * 2 - 1, rng() * 1.4 - 0.25, rng() * 1.6 - 0.4]);
    const r = 0.3 * PUMPKIN_SCALE;
    const start: Vec3 = [PUMPKIN_CENTRE[0] + dir[0] * r, PUMPKIN_CENTRE[1] + dir[1] * r * 0.8, PUMPKIN_CENTRE[2] + dir[2] * r];
    const pick = rng();
    return {
      start,
      dir,
      speed: 7 + rng() * 11,
      axis: unit([rng() - 0.5, rng() - 0.5, rng() - 0.5]),
      spin: 6 + rng() * 14,
      size: 0.07 + rng() * 0.11,
      colour: pick < 0.58 ? 0 : pick < 0.85 ? 1 : 2,
      target,
      side: unit([-dir[2], 0.3, dir[0]]),
    };
  });
}

const DRAG = 3.2;
/** Distance an exploding shard has travelled after `t` seconds (fast start, slowed by drag). */
const travelled = (speed: number, t: number) => (speed * (1 - Math.exp(-DRAG * t))) / DRAG;

function useMaterials() {
  return useMemo(
    () =>
      [PALETTE.pumpkin, PALETTE.flame, "#c2410c"].map(
        (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, flatShading: true, roughness: 0.6 }),
      ),
    [],
  );
}

const ROT = new THREE.Quaternion();
const AXIS = new THREE.Vector3();
const EULER = new THREE.Euler();

function rotationOf(axis: Vec3, angle: number): [number, number, number] {
  ROT.setFromAxisAngle(AXIS.set(axis[0], axis[1], axis[2]), angle);
  EULER.setFromQuaternion(ROT);
  return [EULER.x, EULER.y, EULER.z];
}

/**
 * Intro: the pumpkin bursts into shards with drag, which then swirl together into the letters of the sign
 * and shrink away as the neon lights up.
 */
export function IntroShards({ frame }: { frame: number }) {
  const shards = useMemo(() => makeShards(5), []);
  const geometry = useMemo(() => new THREE.TetrahedronGeometry(1, 0), []);
  const materials = useMaterials();
  if (frame < INTRO.burst || frame >= INTRO.shardsGone) return null;
  const glow = 0.9 + 1.4 * (1 - progress(frame, INTRO.burst, INTRO.burst + 10));
  for (const m of materials) m.emissiveIntensity = glow;
  const burstT = (Math.min(frame, INTRO.burstEnd) - INTRO.burst) / FPS;
  const gather = easeInOutCubic(progress(frame, INTRO.burstEnd, INTRO.gatherEnd));
  const shrink = 1 - progress(frame, INTRO.ignite, INTRO.shardsGone);
  return (
    <>
      {shards.map((s, i) => {
        const d = travelled(s.speed, burstT);
        const p0: Vec3 = [s.start[0] + s.dir[0] * d, s.start[1] + s.dir[1] * d, s.start[2] + s.dir[2] * d];
        const swirl = Math.sin(Math.PI * gather) * 1.4;
        const pos: Vec3 = [
          p0[0] + (s.target[0] - p0[0]) * gather + s.side[0] * swirl,
          p0[1] + (s.target[1] - p0[1]) * gather + s.side[1] * swirl,
          p0[2] + (s.target[2] - p0[2]) * gather + s.side[2] * swirl,
        ];
        // Spin fast in the blast, slow to a stop as they land.
        const spinTime = burstT + ((frame - INTRO.burstEnd) / FPS) * (1 - gather) * 0.6 * (frame > INTRO.burstEnd ? 1 : 0);
        const size = s.size * (1 - gather * 0.35) * shrink;
        return <mesh key={i} geometry={geometry} material={materials[s.colour]} position={pos} rotation={rotationOf(s.axis, s.spin * spinTime)} scale={size} />;
      })}
    </>
  );
}

/** Outro: the sign's letters burst into shards that rise and cool down like embers. */
export function OutroShards({ frame }: { frame: number }) {
  const shards = useMemo(() => makeShards(17), []);
  const geometry = useMemo(() => new THREE.TetrahedronGeometry(1, 0), []);
  const materials = useMaterials();
  if (frame < OUTRO.burst || frame >= OUTRO.embersEnd) return null;
  const t = (frame - OUTRO.burst) / FPS;
  const cool = progress(frame, OUTRO.burst, OUTRO.embersEnd);
  const hot = new THREE.Color(PALETTE.flame);
  const ember = new THREE.Color("#7a1d0c");
  materials.forEach((m, i) => {
    const base = new THREE.Color(i === 2 ? "#c2410c" : i === 1 ? PALETTE.flame : PALETTE.pumpkin);
    m.color.copy(base).lerp(ember, cool);
    m.emissive.copy(base).lerp(ember, cool * 0.8).lerp(hot, Math.max(0, 0.6 - t * 3));
    m.emissiveIntensity = 2.2 - cool * 1.6;
  });
  return (
    <>
      {shards.map((s, i) => {
        const d = travelled(s.speed * 0.75, t);
        // Embers drift upward and sway once the blast has slowed.
        const rise = t * t * 0.35 + t * 0.6;
        const sway = Math.sin(t * 2.2 + i) * 0.25 * cool;
        const pos: Vec3 = [s.target[0] + s.dir[0] * d + sway, s.target[1] + s.dir[1] * d * 0.8 + rise, s.target[2] + Math.abs(s.dir[2]) * d];
        const size = s.size * (1 - cool) * (0.8 + 0.2 * Math.sin(t * 9 + i));
        return <mesh key={i} geometry={geometry} material={materials[s.colour]} position={pos} rotation={rotationOf(s.axis, s.spin * t * 0.6)} scale={Math.max(0, size)} />;
      })}
    </>
  );
}
