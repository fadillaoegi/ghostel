import { GREENHOUSE_BOUNDS, GREENHOUSE_OBSTACLES } from "@ghostel/shared";
import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { Moon, Pumpkin } from "../Decor";
import { makeCheckerTexture, useLabelTexture } from "../textures";

const b = GREENHOUSE_BOUNDS;
const W = b.maxX - b.minX;
const D = b.maxZ - b.minZ;
const FRAME = "#1f3a2a";
const H = 5.5;

/** A giant jack-o'-lantern that glows brighter as a guest walks past. */
function GiantPumpkin({ x, z, r, selfPos }: { x: number; z: number; r: number; selfPos: RefObject<{ x: number; z: number }> }) {
  const face = useRef<THREE.MeshBasicMaterial[]>([]);
  const light = useRef<THREE.PointLight>(null);
  const glow = useRef(0);
  useFrame(({ clock }, dt) => {
    const me = selfPos.current;
    const near = me ? Math.max(0, 1 - Math.hypot(me.x - x, me.z - z) / (r + 3.5)) : 0;
    glow.current += (near - glow.current) * (1 - Math.exp(-Math.min(dt, 0.1) * 4));
    const flicker = Math.sin(clock.elapsedTime * 9 + x) * 0.08;
    const c = new THREE.Color("#ffcf5a").multiplyScalar(0.6 + glow.current * 1.4 + flicker);
    for (const m of face.current) m?.color.copy(c);
    if (light.current) light.current.intensity = 3 + glow.current * 14;
  });
  const scale = r / 0.43;
  return (
    <group position={[x, 0, z]}>
      <group scale={scale}>
        <mesh position={[0, 0.3, 0]} scale={[1.2, 0.85, 1.2]}>
          <sphereGeometry args={[0.36, 10, 7]} />
          <meshStandardMaterial color="#ff7a1a" flatShading roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.66, 0]} rotation={[0.2, 0, 0.3]}>
          <cylinderGeometry args={[0.035, 0.06, 0.18, 5]} />
          <meshStandardMaterial color="#3f7d20" flatShading />
        </mesh>
        {[-0.13, 0.13].map((ex, i) => (
          <mesh key={ex} position={[ex, 0.38, 0.39]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.07, 0.1, 3]} />
            <meshBasicMaterial ref={(m) => void (m && (face.current[i] = m))} color="#ffcf5a" toneMapped={false} />
          </mesh>
        ))}
        <mesh position={[0, 0.2, 0.4]} scale={[1, 0.4, 0.3]}>
          <sphereGeometry args={[0.16, 6, 3, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshBasicMaterial ref={(m) => void (m && (face.current[2] = m))} color="#ffcf5a" toneMapped={false} />
        </mesh>
      </group>
      <pointLight ref={light} position={[0, r * 0.9, r + 0.4]} color="#ff9a2e" intensity={3} distance={8} decay={1.6} />
    </group>
  );
}

function Cauldron() {
  const bubbles = useRef<THREE.Group>(null);
  const fire = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    bubbles.current?.children.forEach((c, i) => {
      const p = (t * 0.6 + i * 0.37) % 1;
      c.position.set(Math.cos(i * 2.1) * 0.6, 1.15 + p * 0.9, Math.sin(i * 2.1) * 0.6);
      c.scale.setScalar(0.6 + p);
    });
    fire.current?.children.forEach((c, i) => {
      c.scale.y = 1 + Math.sin(t * 12 + i) * 0.25;
    });
  });
  return (
    <group>
      <mesh position={[0, 0.65, 0]}>
        <sphereGeometry args={[1.25, 12, 8, 0, Math.PI * 2, Math.PI * 0.18, Math.PI * 0.82]} />
        <meshStandardMaterial color="#141018" metalness={0.6} roughness={0.5} flatShading side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 1.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.05, 14]} />
        <meshStandardMaterial color="#43ff6e" emissive="#43ff6e" emissiveIntensity={1.3} />
      </mesh>
      <group ref={bubbles}>
        {Array.from({ length: 7 }, (_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.09, 8, 6]} />
            <meshStandardMaterial color="#9affd6" emissive="#43ff6e" emissiveIntensity={1} transparent opacity={0.75} />
          </mesh>
        ))}
      </group>
      <group ref={fire} position={[0, 0.1, 0]}>
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} position={[Math.cos((i / 6) * Math.PI * 2) * 0.5, 0.15, Math.sin((i / 6) * Math.PI * 2) * 0.5]}>
            <coneGeometry args={[0.16, 0.45, 5]} />
            <meshBasicMaterial color={i % 2 ? "#ff7a1a" : "#ffcf5a"} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <pointLight position={[0, 2, 0]} color="#43ff6e" intensity={12} distance={10} decay={1.6} />
    </group>
  );
}

function Planter({ minX, maxX, minZ, maxZ }: { minX: number; maxX: number; minZ: number; maxZ: number }) {
  const w = maxX - minX;
  const d = maxZ - minZ;
  const cx = (minX + maxX) / 2;
  return (
    <group position={[cx, 0, (minZ + maxZ) / 2]}>
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[w, 0.7, d]} />
        <meshStandardMaterial color="#4a2d1b" flatShading />
      </mesh>
      <mesh position={[0, 0.71, 0]}>
        <boxGeometry args={[w - 0.2, 0.04, d - 0.2]} />
        <meshStandardMaterial color="#2a1a10" />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => (
        <group key={i} position={[0, 0.72, -d / 2 + 1 + i * ((d - 2) / 6)]}>
          {i % 2 === 0 ? (
            <Pumpkin position={[0, 0, 0]} scale={0.55} rotationY={cx > 0 ? -Math.PI / 2 : Math.PI / 2} />
          ) : (
            <mesh position={[0, 0.35, 0]}>
              <coneGeometry args={[0.25, 0.7, 5]} />
              <meshStandardMaterial color="#3f7d20" flatShading />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

function GlassWall({ length, position, rotationY }: { length: number; position: [number, number, number]; rotationY: number }) {
  const panes = Math.round(length / 2.4);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, H / 2, 0]}>
        <planeGeometry args={[length, H]} />
        <meshStandardMaterial color="#7fb8c9" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {Array.from({ length: panes + 1 }, (_, i) => (
        <mesh key={i} position={[-length / 2 + (i * length) / panes, H / 2, 0]}>
          <boxGeometry args={[0.12, H, 0.12]} />
          <meshStandardMaterial color={FRAME} />
        </mesh>
      ))}
      {[0.05, H / 2, H].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[length, 0.1, 0.12]} />
          <meshStandardMaterial color={FRAME} />
        </mesh>
      ))}
    </group>
  );
}

export function Greenhouse({ selfPos }: { selfPos: RefObject<{ x: number; z: number }> }) {
  const tiles = useMemo(() => {
    const t = makeCheckerTexture("#2a3a2a", "#1f2b20", "#3a4f3a");
    t.repeat.set(W / 2.5, D / 2.5);
    return t;
  }, []);
  const sign = useLabelTexture("Moonlit Greenhouse", { font: "Creepster", size: 104, color: "#d4ffb0", glow: "#43ff6e", width: 1024, height: 170 });
  return (
    <group>
      <ambientLight intensity={0.9} color="#7aa890" />
      <hemisphereLight args={["#9ad0ff", "#10180f", 0.85]} />
      <directionalLight position={[6, 14, -10]} intensity={0.8} color="#bcd4ff" />
      <Moon position={[-10, 16, -32]} size={4} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W + 2, D + 2]} />
        <meshStandardMaterial map={tiles} roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, b.maxZ + 6]}>
        <planeGeometry args={[W + 16, 12]} />
        <meshStandardMaterial color="#0b120c" />
      </mesh>
      {/* a gravel path from the elevator to the cauldron */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -5.5]}>
        <planeGeometry args={[2.4, 11]} />
        <meshStandardMaterial color="#4b4038" roughness={1} />
      </mesh>
      <GlassWall length={W} position={[0, 0, b.minZ - 0.05]} rotationY={0} />
      <GlassWall length={D} position={[b.minX - 0.05, 0, 0]} rotationY={Math.PI / 2} />
      <GlassWall length={D} position={[b.maxX + 0.05, 0, 0]} rotationY={Math.PI / 2} />
      {/* back wall behind the elevator so it has something to sit in */}
      <mesh position={[0, 2, b.minZ - 0.25]}>
        <boxGeometry args={[3.4, 4, 0.4]} />
        <meshStandardMaterial color="#1f3a2a" />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (W / 4 + 1), 0.35, b.maxZ + 0.3]}>
          <boxGeometry args={[W / 2 - 2, 0.7, 0.4]} />
          <meshStandardMaterial color="#2a1a10" />
        </mesh>
      ))}
      <mesh position={[0, 4.6, b.minZ + 0.1]}>
        <planeGeometry args={[6.4, 1.06]} />
        <meshBasicMaterial map={sign} transparent toneMapped={false} />
      </mesh>
      {GREENHOUSE_OBSTACLES.map((o, i) => {
        if (o.kind === "circle" && o.label === "giant-pumpkin") return <GiantPumpkin key={i} x={o.x} z={o.z} r={o.r} selfPos={selfPos} />;
        if (o.kind === "circle" && o.label === "cauldron") return <Cauldron key={i} />;
        if (o.kind === "box") return <Planter key={i} {...o} />;
        return null;
      })}
      <Sparkles count={110} scale={[W, 3.5, D]} position={[0, 1.6, 0]} size={3.2} speed={0.5} opacity={0.85} color="#e6ff7a" />
    </group>
  );
}
