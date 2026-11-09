import { ROOFTOP_BOUNDS, ROOFTOP_TOMBSTONES } from "@ghostel/shared";
import { Sparkles, Stars } from "@react-three/drei";
import { useMemo } from "react";
import { Bat, Candle, Moon, Pumpkin } from "../Decor";
import { makeCheckerTexture, useLabelTexture } from "../textures";
import { City } from "./City";

const b = ROOFTOP_BOUNDS;
const W = b.maxX - b.minX;
const D = b.maxZ - b.minZ;
const STONE = "#5a5470";

function Tombstone({ x, z, tilt }: { x: number; z: number; tilt: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, tilt, tilt * 0.3]}>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.9, 0.9, 0.3]} />
        <meshStandardMaterial color={STONE} flatShading />
      </mesh>
      <mesh position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.45, 0.45, 0.3, 8, 1, false, -Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color={STONE} flatShading />
      </mesh>
      <mesh position={[0, 0.7, 0.16]}>
        <boxGeometry args={[0.08, 0.4, 0.02]} />
        <meshStandardMaterial color="#2a2438" />
      </mesh>
      <mesh position={[0, 0.78, 0.16]}>
        <boxGeometry args={[0.28, 0.08, 0.02]} />
        <meshStandardMaterial color="#2a2438" />
      </mesh>
      <mesh position={[0, 0.02, 0.55]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshStandardMaterial color="#2c3a24" />
      </mesh>
    </group>
  );
}

function WaterTower({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([lx, lz]) => (
        <mesh key={`${lx}${lz}`} position={[(lx as number) * 1.05, 1.6, (lz as number) * 1.05]}>
          <cylinderGeometry args={[0.08, 0.1, 3.2, 5]} />
          <meshStandardMaterial color="#3b2416" />
        </mesh>
      ))}
      <mesh position={[0, 4.2, 0]}>
        <cylinderGeometry args={[1.5, 1.5, 2.2, 12]} />
        <meshStandardMaterial color="#5a3a22" flatShading roughness={0.9} />
      </mesh>
      <mesh position={[0, 5.7, 0]}>
        <coneGeometry args={[1.65, 0.9, 12]} />
        <meshStandardMaterial color="#2a1a10" flatShading />
      </mesh>
    </group>
  );
}

function Telescope({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((a) => (
        <mesh key={a} position={[Math.cos(a) * 0.35, 0.6, Math.sin(a) * 0.35]} rotation={[Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35]}>
          <cylinderGeometry args={[0.03, 0.04, 1.3, 4]} />
          <meshStandardMaterial color="#3b2416" />
        </mesh>
      ))}
      <mesh position={[0, 1.45, 0]} rotation={[-0.75, 0, 0.35]}>
        <cylinderGeometry args={[0.14, 0.2, 1.6, 10]} />
        <meshStandardMaterial color="#c9a227" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Mausoleum() {
  const name = useLabelTexture("R.I.P.", { font: "Creepster", size: 80, color: "#e9dcff", glow: "#8b5cf6", width: 256, height: 110 });
  return (
    <group position={[10, 0, 6]}>
      <mesh position={[0, 1.3, 0]}>
        <boxGeometry args={[3, 2.6, 3]} />
        <meshStandardMaterial color="#6b6584" flatShading roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.95, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[2.3, 1.1, 4]} />
        <meshStandardMaterial color="#4b4560" flatShading />
      </mesh>
      {[-1.25, 1.25].map((px) => (
        <mesh key={px} position={[px, 1.2, 1.55]}>
          <cylinderGeometry args={[0.14, 0.16, 2.4, 6]} />
          <meshStandardMaterial color="#8a84a0" flatShading />
        </mesh>
      ))}
      <mesh position={[0, 0.9, 1.51]}>
        <boxGeometry args={[1, 1.8, 0.05]} />
        <meshStandardMaterial color="#1a1024" emissive="#8b5cf6" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 2.25, 1.53]}>
        <planeGeometry args={[1.2, 0.5]} />
        <meshBasicMaterial map={name} transparent toneMapped={false} />
      </mesh>
      <pointLight position={[0, 1.2, 2.4]} color="#b18cff" intensity={6} distance={6} />
    </group>
  );
}

export function Rooftop() {
  const slate = useMemo(() => {
    const t = makeCheckerTexture("#2b2838", "#232030", "#3a3650");
    t.repeat.set(W / 2, D / 2);
    return t;
  }, []);
  const sign = useLabelTexture("Rooftop Graveyard", { font: "Creepster", size: 100, color: "#e9dcff", glow: "#8b5cf6", width: 1024, height: 170 });
  return (
    <group>
      <ambientLight intensity={0.55} color="#7a78b8" />
      <hemisphereLight args={["#9ab0ff", "#120a1a", 0.55]} />
      <directionalLight position={[0, 18, -30]} intensity={1.1} color="#dfe6ff" />
      <Moon position={[0, 20, -42]} size={9} />
      <Stars radius={60} depth={20} count={1800} factor={3} saturation={0} fade speed={0.6} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W + 2, D + 2]} />
        <meshStandardMaterial map={slate} roughness={0.8} />
      </mesh>
      {/* graveyard turf */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-8.5, 0.01, 5.5]}>
        <planeGeometry args={[8, 6]} />
        <meshStandardMaterial color="#24301f" roughness={1} />
      </mesh>
      {/* low parapet all around: an open roof under the sky */}
      {[
        { p: [0, 0.4, b.minZ - 0.25], s: [W + 1, 0.8, 0.5] },
        { p: [0, 0.4, b.maxZ + 0.25], s: [W + 1, 0.8, 0.5] },
        { p: [b.minX - 0.25, 0.4, 0], s: [0.5, 0.8, D] },
        { p: [b.maxX + 0.25, 0.4, 0], s: [0.5, 0.8, D] },
      ].map(({ p, s }, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <boxGeometry args={s as [number, number, number]} />
          <meshStandardMaterial color="#3a3650" flatShading />
        </mesh>
      ))}
      {/* elevator hut */}
      <mesh position={[0, 1.7, b.minZ - 0.8]}>
        <boxGeometry args={[3.6, 3.4, 1.6]} />
        <meshStandardMaterial color="#3a3650" flatShading />
      </mesh>
      <mesh position={[0, 3.55, b.minZ - 0.8]}>
        <boxGeometry args={[4, 0.3, 2]} />
        <meshStandardMaterial color="#2b2838" />
      </mesh>
      <mesh position={[0, 4.3, b.minZ - 0.6]}>
        <planeGeometry args={[6, 1]} />
        <meshBasicMaterial map={sign} transparent toneMapped={false} />
      </mesh>
      <WaterTower x={-11} z={-7} />
      <Telescope x={10} z={-7.5} />
      <Mausoleum />
      {ROOFTOP_TOMBSTONES.map((t, i) => (
        <Tombstone key={i} x={t.x} z={t.z} tilt={((i * 37) % 7) / 30 - 0.1} />
      ))}
      {/* chimneys */}
      {[
        [-3, -9],
        [5, 2],
        [-13, 9.5],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x as number, 0.9, z as number]}>
          <boxGeometry args={[0.8, 1.8, 0.8]} />
          <meshStandardMaterial color="#5c2a22" flatShading />
        </mesh>
      ))}
      <Pumpkin position={[-4.6, 0, 8.8]} scale={1} rotationY={2.8} lit />
      <Pumpkin position={[6.5, 0, 9]} scale={0.8} rotationY={-2.6} lit />
      <group position={[-8.5, 0, 9.2]}>
        <Candle position={[0, 0, 0]} height={0.45} />
        <Candle position={[0.2, 0, 0.1]} height={0.3} />
      </group>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <Bat key={i} radius={6 + i * 1.4} height={6 + (i % 3)} speed={0.3 + (i % 4) * 0.07} offset={i * 1.3} />
      ))}
      <Sparkles count={50} scale={[W, 4, D]} position={[0, 2, 0]} size={2} speed={0.2} opacity={0.5} color="#c4b5fd" />
      <City />
    </group>
  );
}
