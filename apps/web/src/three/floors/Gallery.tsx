import { GALLERY_BOUNDS, GALLERY_MIRROR, GALLERY_OBSTACLES, GALLERY_PORTRAITS } from "@ghostel/shared";
import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { Candle } from "../Decor";
import { makeCheckerTexture, useLabelTexture } from "../textures";

const b = GALLERY_BOUNDS;
const W = b.maxX - b.minX;
const D = b.maxZ - b.minZ;
const WALL_H = 5;
const GOLD = "#c9a227";

const SITTERS = [
  { bg: "#2b1d3a", skin: "#d9c7a0", coat: "#5c0f1f", hair: "#1a1024" },
  { bg: "#1d2b28", skin: "#c9d6c2", coat: "#2b2d42", hair: "#6b4e1f" },
  { bg: "#3a1d1d", skin: "#e3c9b0", coat: "#3f7d20", hair: "#e9d8a6" },
  { bg: "#1d233a", skin: "#bfb3d9", coat: "#8b5cf6", hair: "#2a1a08" },
  { bg: "#2a2a1d", skin: "#d6c2a0", coat: "#c81d25", hair: "#1a1024" },
  { bg: "#1a1a2a", skin: "#a8c4b8", coat: "#123c3a", hair: "#4a2d1b" },
];

/** A painting whose eyes follow the guest across the gallery. */
function Portrait({ x, i, selfPos }: { x: number; i: number; selfPos: RefObject<{ x: number; z: number }> }) {
  const pupils = useRef<THREE.Group>(null);
  const s = SITTERS[i % SITTERS.length] ?? SITTERS[0]!;
  useFrame(() => {
    const me = selfPos.current;
    if (!me || !pupils.current) return;
    const dx = THREE.MathUtils.clamp((me.x - x) / 8, -1, 1);
    const dz = THREE.MathUtils.clamp((me.z - b.minZ) / 10, 0, 1);
    pupils.current.position.x = dx * 0.035;
    pupils.current.position.y = -dz * 0.03;
  });
  return (
    <group position={[x, 2.7, b.minZ + 0.08]}>
      {/* frame */}
      <mesh>
        <boxGeometry args={[1.9, 2.4, 0.12]} />
        <meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.07]}>
        <planeGeometry args={[1.6, 2.1]} />
        <meshStandardMaterial color={s.bg} roughness={1} />
      </mesh>
      {/* sitter */}
      <mesh position={[0, -0.65, 0.08]}>
        <circleGeometry args={[0.62, 12, 0, Math.PI]} />
        <meshStandardMaterial color={s.coat} roughness={1} />
      </mesh>
      <mesh position={[0, 0.12, 0.08]} scale={[1, 1.2, 1]}>
        <circleGeometry args={[0.36, 14]} />
        <meshStandardMaterial color={s.skin} roughness={1} />
      </mesh>
      <mesh position={[0, 0.42, 0.085]} scale={[1.1, 0.5, 1]}>
        <circleGeometry args={[0.36, 14, 0, Math.PI]} />
        <meshStandardMaterial color={s.hair} roughness={1} />
      </mesh>
      {[-0.12, 0.12].map((ex) => (
        <mesh key={ex} position={[ex, 0.18, 0.09]}>
          <circleGeometry args={[0.065, 12]} />
          <meshBasicMaterial color="#f4f1de" />
        </mesh>
      ))}
      <group ref={pupils}>
        {[-0.12, 0.12].map((ex) => (
          <mesh key={ex} position={[ex, 0.18, 0.095]}>
            <circleGeometry args={[0.03, 10]} />
            <meshBasicMaterial color="#120a1a" />
          </mesh>
        ))}
      </group>
      <mesh position={[0, -0.02, 0.09]}>
        <planeGeometry args={[0.16, 0.025]} />
        <meshBasicMaterial color="#5c0f1f" />
      </mesh>
      {/* picture light */}
      <mesh position={[0, 1.32, 0.18]}>
        <boxGeometry args={[0.9, 0.06, 0.12]} />
        <meshStandardMaterial color={GOLD} emissive="#ffcf7a" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

function Armour({ x, z }: { x: number; z: number }) {
  const steel = { color: "#8a8fa0", metalness: 0.9, roughness: 0.35, flatShading: true } as const;
  return (
    <group position={[x, 0, z]} rotation={[0, z < 0 ? 0 : Math.PI, 0]}>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.8, 0.2, 0.6]} />
        <meshStandardMaterial color="#2a1a2a" />
      </mesh>
      {[-0.13, 0.13].map((lx) => (
        <mesh key={lx} position={[lx, 0.6, 0]}>
          <cylinderGeometry args={[0.09, 0.11, 0.8, 6]} />
          <meshStandardMaterial {...steel} />
        </mesh>
      ))}
      <mesh position={[0, 1.3, 0]}>
        <cylinderGeometry args={[0.3, 0.24, 0.65, 7]} />
        <meshStandardMaterial {...steel} />
      </mesh>
      <mesh position={[0, 1.85, 0]}>
        <cylinderGeometry args={[0.17, 0.2, 0.36, 7]} />
        <meshStandardMaterial {...steel} />
      </mesh>
      <mesh position={[0, 1.85, 0.19]}>
        <boxGeometry args={[0.22, 0.04, 0.02]} />
        <meshBasicMaterial color="#ff3b3b" toneMapped={false} />
      </mesh>
      <mesh position={[0.36, 1.6, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 2.2, 4]} />
        <meshStandardMaterial color="#5a4c6e" metalness={0.6} />
      </mesh>
      <mesh position={[0.36, 2.75, 0]}>
        <coneGeometry args={[0.07, 0.25, 4]} />
        <meshStandardMaterial {...steel} />
      </mesh>
    </group>
  );
}

/** The Mirror of Costumes: a shimmering oval on the east wall. */
function Mirror() {
  const surface = useRef<THREE.MeshStandardMaterial>(null);
  const title = useLabelTexture("Mirror of Costumes", { font: "Creepster", size: 64, color: "#ffe2b0", glow: "#8b5cf6", width: 768, height: 110 });
  useFrame(({ clock }) => {
    if (!surface.current) return;
    const t = clock.elapsedTime;
    surface.current.emissive.setHSL(0.72 + Math.sin(t * 0.5) * 0.08, 0.6, 0.35 + Math.sin(t * 1.3) * 0.06);
  });
  return (
    <group position={[GALLERY_MIRROR.x, 2.3, b.minZ + 0.1]}>
      <mesh scale={[1, 1.45, 1]}>
        <torusGeometry args={[1.05, 0.12, 6, 24]} />
        <meshStandardMaterial color={GOLD} metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh scale={[1, 1.45, 1]} position={[0, 0, -0.02]}>
        <circleGeometry args={[1.02, 24]} />
        <meshStandardMaterial ref={surface} color="#9fb7ff" metalness={1} roughness={0.08} emissive="#5b3fa8" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0, 1.95, 0.05]}>
        <planeGeometry args={[3.2, 0.46]} />
        <meshBasicMaterial map={title} transparent toneMapped={false} />
      </mesh>
      <Sparkles count={24} scale={[2.4, 3.2, 0.6]} position={[0, 0, 0.4]} size={3} speed={0.4} color="#d9c8ff" />
    </group>
  );
}

function Runway() {
  const lights = useMemo(() => Array.from({ length: 9 }, (_, i) => -4 + i), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <planeGeometry args={[3.4, D - 0.4]} />
        <meshStandardMaterial color="#1a0f24" roughness={0.4} metalness={0.3} />
      </mesh>
      {[-1.7, 1.7].map((x) =>
        lights.map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.05, z]}>
            <sphereGeometry args={[0.06, 6, 4]} />
            <meshBasicMaterial color="#ffcf7a" toneMapped={false} />
          </mesh>
        )),
      )}
      {/* spotlight cones from above */}
      {[-2.2, 2.2].map((z) => (
        <group key={z}>
          <spotLight position={[0, 6.5, z]} angle={0.42} penumbra={0.6} intensity={45} distance={12} color="#ffe2b8" target-position={[0, 0, z]} />
          <mesh position={[0, 3.3, z]}>
            <coneGeometry args={[1.6, 6.2, 16, 1, true]} />
            <meshBasicMaterial color="#ffe2b8" transparent opacity={0.05} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Gallery({ selfPos }: { selfPos: RefObject<{ x: number; z: number }> }) {
  const floor = useMemo(() => {
    const t = makeCheckerTexture("#5a3a22", "#3b2416", "#6b4a2a");
    t.repeat.set(W / 2, D / 2);
    return t;
  }, []);
  const sign = useLabelTexture("Hall of Portraits", { font: "Creepster", size: 110, color: "#ffd08a", glow: "#ff7a1a", width: 1024, height: 170 });
  return (
    <group>
      <ambientLight intensity={0.95} color="#9a88c8" />
      <hemisphereLight args={["#c9b0ff", "#2a1530", 0.8]} />
      <directionalLight position={[4, 12, 10]} intensity={0.6} color="#ffe2c4" />
      {[-14, -7, 0, 7, 14].map((x) => (
        <pointLight key={x} position={[x, 3.6, -1.5]} intensity={9} distance={11} decay={1.5} color="#ffc47a" />
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W + 2, D + 2]} />
        <meshStandardMaterial map={floor} roughness={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[W - 1, 1.6]} />
        <meshStandardMaterial color="#4a1030" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, b.maxZ + 6]}>
        <planeGeometry args={[W + 16, 12]} />
        <meshStandardMaterial color="#0d0914" />
      </mesh>
      {/* walls: north tall with wallpaper, west/east tall, south low */}
      <mesh position={[0, WALL_H / 2, b.minZ - 0.4]}>
        <boxGeometry args={[W + 1.6, WALL_H, 0.8]} />
        <meshStandardMaterial color="#5a2440" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.6, b.minZ + 0.02]}>
        <boxGeometry args={[W, 1.2, 0.06]} />
        <meshStandardMaterial color="#1a0d14" />
      </mesh>
      <mesh position={[0, 1.22, b.minZ + 0.05]}>
        <boxGeometry args={[W, 0.06, 0.08]} />
        <meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.4} />
      </mesh>
      {[b.minX - 0.4, b.maxX + 0.4].map((x) => (
        <mesh key={x} position={[x, WALL_H / 2, 0]}>
          <boxGeometry args={[0.8, WALL_H, D]} />
          <meshStandardMaterial color="#5a2440" roughness={0.95} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (W / 4 + 1), 0.35, b.maxZ + 0.4]}>
          <boxGeometry args={[W / 2 - 2, 0.7, 0.8]} />
          <meshStandardMaterial color="#5a2440" />
        </mesh>
      ))}
      <mesh position={[0, 4.3, b.minZ + 0.06]}>
        <planeGeometry args={[6, 1]} />
        <meshBasicMaterial map={sign} transparent toneMapped={false} />
      </mesh>
      {GALLERY_PORTRAITS.map((x, i) => (
        <Portrait key={x} x={x} i={i} selfPos={selfPos} />
      ))}
      {GALLERY_OBSTACLES.map((o, i) => (o.kind === "circle" ? <Armour key={i} x={o.x} z={o.z} /> : null))}
      <Runway />
      <Mirror />
      {/* floating candles along the hall */}
      {[-13, -7, -1, 5, 11].map((x, i) => (
        <group key={x} position={[x, 3.6 + (i % 2) * 0.4, 1.2 - (i % 3)]}>
          <Candle position={[0, 0, 0]} height={0.4} />
        </group>
      ))}
      <Sparkles count={60} scale={[W, 4, D]} position={[0, 2.4, 0]} size={2} speed={0.25} opacity={0.5} color="#e9d8a6" />
    </group>
  );
}
