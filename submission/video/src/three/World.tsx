import { useMemo } from "react";
import * as THREE from "three";
import { seeded } from "./random";
import { PALETTE, glowTexture, groundTexture } from "./textures";

// The night graveyard in front of the hotel, built in layers at many depths so the camera's motion reads as 3D:
// fence posts right next to the path, tombstones and lamps along it, trees and the hotel behind, the moon and
// stars far away. All low-poly primitives in Ghostel's palette.

function Tombstone({ x, z, tilt, scale }: { x: number; z: number; tilt: number; scale: number }) {
  return (
    <group position={[x, 0, z]} rotation={[tilt * 0.15, tilt, tilt * 0.12]} scale={scale}>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.7, 0.9, 0.18]} />
        <meshStandardMaterial color={PALETTE.tomb} flatShading />
      </mesh>
      <mesh position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 0.18, 8, 1, false, -Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color={PALETTE.tomb} flatShading />
      </mesh>
      <mesh position={[0, 0.6, 0.1]}>
        <boxGeometry args={[0.32, 0.06, 0.02]} />
        <meshStandardMaterial color="#2a2438" />
      </mesh>
    </group>
  );
}

function Cross({ x, z, tilt }: { x: number; z: number; tilt: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, tilt, tilt * 0.2]}>
      <mesh position={[0, 0.65, 0]}>
        <boxGeometry args={[0.14, 1.3, 0.14]} />
        <meshStandardMaterial color={PALETTE.stone} flatShading />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <boxGeometry args={[0.6, 0.14, 0.14]} />
        <meshStandardMaterial color={PALETTE.stone} flatShading />
      </mesh>
    </group>
  );
}

function LampPost({ x, z, glow }: { x: number; z: number; glow: THREE.Texture }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.06, 0.09, 2.8, 6]} />
        <meshStandardMaterial color="#120a1a" flatShading />
      </mesh>
      <mesh position={[0, 2.95, 0]}>
        <boxGeometry args={[0.32, 0.4, 0.32]} />
        <meshStandardMaterial color="#ffb347" emissive={PALETTE.pumpkinGlow} emissiveIntensity={2.2} toneMapped={false} />
      </mesh>
      <mesh position={[0, 3.25, 0]}>
        <coneGeometry args={[0.28, 0.25, 4]} />
        <meshStandardMaterial color="#120a1a" flatShading />
      </mesh>
      <sprite position={[0, 2.95, 0]} scale={[2.2, 2.2, 1]}>
        <spriteMaterial map={glow} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
    </group>
  );
}

function DeadTree({ x, z, scale, turn }: { x: number; z: number; scale: number; turn: number }) {
  return (
    <group position={[x, 0, z]} scale={scale} rotation={[0, turn, 0]}>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.08, 0.2, 3.2, 6]} />
        <meshStandardMaterial color="#160d22" flatShading />
      </mesh>
      {[
        [0.5, 2.4, 0.9],
        [-0.45, 2.0, -0.8],
        [0.2, 2.9, 0.4],
      ].map(([bx, by, rz], i) => (
        <mesh key={i} position={[bx as number, by as number, 0]} rotation={[0, 0, rz as number]}>
          <cylinderGeometry args={[0.03, 0.07, 1.3, 5]} />
          <meshStandardMaterial color="#160d22" flatShading />
        </mesh>
      ))}
    </group>
  );
}

/** The hotel far behind the pedestal: a dark block with lit windows and a pointed roof. */
function Hotel() {
  const windows = useMemo(() => {
    const rng = seeded(41);
    const out: { x: number; y: number; warm: boolean; on: boolean }[] = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 9; col++) out.push({ x: -8 + col * 2, y: 2 + row * 2.4, warm: rng() < 0.7, on: rng() < 0.72 });
    }
    return out;
  }, []);
  return (
    <group position={[0, 0, -22]}>
      <mesh position={[0, 5.5, 0]}>
        <boxGeometry args={[20, 11, 4]} />
        <meshStandardMaterial color="#1b1129" flatShading />
      </mesh>
      <mesh position={[0, 13, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[12, 4.5, 4]} />
        <meshStandardMaterial color="#130b1e" flatShading />
      </mesh>
      {[-7.5, 7.5].map((x) => (
        <group key={x} position={[x, 0, 0.5]}>
          <mesh position={[0, 8, 0]}>
            <cylinderGeometry args={[1.3, 1.5, 16, 8]} />
            <meshStandardMaterial color="#1e1430" flatShading />
          </mesh>
          <mesh position={[0, 17.5, 0]}>
            <coneGeometry args={[1.9, 3.5, 8]} />
            <meshStandardMaterial color="#130b1e" flatShading />
          </mesh>
        </group>
      ))}
      {windows
        .filter((w) => w.on)
        .map((w, i) => (
          <mesh key={i} position={[w.x, w.y, 2.02]}>
            <planeGeometry args={[0.9, 1.3]} />
            <meshBasicMaterial color={w.warm ? "#ffb347" : "#9f87ff"} toneMapped={false} />
          </mesh>
        ))}
    </group>
  );
}

function Stars() {
  const geometry = useMemo(() => {
    const rng = seeded(7);
    const pts: number[] = [];
    for (let i = 0; i < 1100; i++) {
      const a = rng() * Math.PI * 2;
      const up = 0.08 + rng() * 0.9;
      const r = 110;
      pts.push(Math.cos(a) * Math.sqrt(1 - up * up) * r, up * r, Math.sin(a) * Math.sqrt(1 - up * up) * r - 20);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  return (
    <points geometry={geometry}>
      <pointsMaterial color="#e9e4ff" size={0.35} sizeAttenuation fog={false} transparent opacity={0.9} />
    </points>
  );
}

function Moon({ halo }: { halo: THREE.Texture }) {
  return (
    <group position={[-18, 22, -60]}>
      <mesh>
        <sphereGeometry args={[4.2, 24, 16]} />
        <meshBasicMaterial color={PALETTE.moon} fog={false} toneMapped={false} />
      </mesh>
      <sprite scale={[26, 26, 1]}>
        <spriteMaterial map={halo} transparent opacity={0.5} depthWrite={false} fog={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </group>
  );
}

/** Low, slowly drifting fog puffs at several depths. */
function Mist({ frame, puff }: { frame: number; puff: THREE.Texture }) {
  const puffs = useMemo(() => {
    const rng = seeded(23);
    return Array.from({ length: 16 }, () => ({ x: (rng() - 0.5) * 22, y: 0.3 + rng() * 1.1, z: -10 + rng() * 44, s: 5 + rng() * 6, v: (rng() - 0.5) * 0.02 }));
  }, []);
  return (
    <>
      {puffs.map((p, i) => (
        <sprite key={i} position={[p.x + frame * p.v, p.y, p.z]} scale={[p.s, p.s * 0.45, 1]}>
          <spriteMaterial map={puff} transparent opacity={0.16} depthWrite={false} />
        </sprite>
      ))}
    </>
  );
}

export function Lights({ moonLight = 0.9 }: { moonLight?: number }) {
  return (
    <>
      <ambientLight intensity={0.7} color="#7a68a8" />
      <hemisphereLight args={["#6b5ba0", "#1a0f24", 1.0]} />
      <directionalLight position={[-18, 22, -20]} intensity={moonLight} color="#a9bcff" />
      {[-2.4, 2.4].map((x) => (
        <pointLight key={x} position={[x, 2.8, 5]} color={PALETTE.pumpkinGlow} intensity={8} distance={11} decay={1.6} />
      ))}
    </>
  );
}

export function World({ frame }: { frame: number }) {
  const ground = useMemo(() => groundTexture(), []);
  const lampGlow = useMemo(() => glowTexture("rgba(255,170,70,0.9)"), []);
  const halo = useMemo(() => glowTexture("rgba(255,240,210,0.55)"), []);
  const puff = useMemo(() => glowTexture("rgba(150,130,200,0.7)"), []);
  const props = useMemo(() => {
    const rng = seeded(99);
    const stones: { x: number; z: number; tilt: number; scale: number; cross: boolean }[] = [];
    for (let z = -6; z < 40; z += 1.7) {
      for (const side of [-1, 1]) {
        if (rng() < 0.25) continue;
        stones.push({ x: side * (2.8 + rng() * 5.5), z: z + rng() * 1.2, tilt: (rng() - 0.5) * 0.7, scale: 0.8 + rng() * 0.6, cross: rng() < 0.22 });
      }
    }
    return stones;
  }, []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial map={ground} roughness={0.9} />
      </mesh>
      {/* the path to the pedestal */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 18]}>
        <planeGeometry args={[3.2, 44]} />
        <meshStandardMaterial color="#2c2440" roughness={0.9} />
      </mesh>
      {props.map((s, i) => (s.cross ? <Cross key={i} x={s.x} z={s.z} tilt={s.tilt} /> : <Tombstone key={i} {...s} />))}
      {/* fence posts right beside the path: the closest layer, they rush past the camera */}
      {Array.from({ length: 22 }, (_, i) => 9 + i * 1.5).flatMap((z) =>
        [-1.95, 1.95].map((x) => (
          <mesh key={`${x}:${z}`} position={[x, 0.55, z]}>
            <boxGeometry args={[0.09, 1.1, 0.09]} />
            <meshStandardMaterial color="#1a1026" flatShading />
          </mesh>
        )),
      )}
      {[-1.95, 1.95].map((x) => (
        <mesh key={x} position={[x, 0.85, 24.75]}>
          <boxGeometry args={[0.05, 0.05, 31.5]} />
          <meshStandardMaterial color="#1a1026" />
        </mesh>
      ))}
      {[6, 14, 22, 30].flatMap((z) => [-2.4, 2.4].map((x) => <LampPost key={`${x}:${z}`} x={x} z={z} glow={lampGlow} />))}
      <DeadTree x={-9} z={-4} scale={1.4} turn={0.4} />
      <DeadTree x={10} z={-8} scale={1.8} turn={2.1} />
      <DeadTree x={-12} z={14} scale={1.2} turn={1.2} />
      <DeadTree x={11} z={20} scale={1.5} turn={4.0} />
      <Hotel />
      <Moon halo={halo} />
      <Stars />
      <Mist frame={frame} puff={puff} />
    </group>
  );
}
