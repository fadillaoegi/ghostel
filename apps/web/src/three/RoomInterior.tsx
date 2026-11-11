import { ROOM_BOUNDS, roomTable, type RoomDecor } from "@ghostel/shared";
import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Pumpkin } from "./Decor";
import { LongTable, TABLE_PALETTES } from "./Tables";
import { makeCheckerTexture, useLabelTexture } from "./textures";

interface Theme {
  wall: string;
  trim: string;
  floorA: string;
  floorB: string;
  line: string;
  light: string;
  sparkle: string;
  sign: string;
  glow: string;
}

const THEMES: Record<RoomDecor, Theme> = {
  crypt: {
    wall: "#1c2a26",
    trim: "#4f6b5c",
    floorA: "#1a2420",
    floorB: "#101714",
    line: "#2c3d35",
    light: "#6bff9e",
    sparkle: "#9affd6",
    sign: "#c8ffe0",
    glow: "#3dff8f",
  },
  library: {
    wall: "#2a1b3d",
    trim: "#b88a3e",
    floorA: "#3b2416",
    floorB: "#2e1b10",
    line: "#4a2f1d",
    light: "#b18cff",
    sparkle: "#d9c8ff",
    sign: "#e9dcff",
    glow: "#8b5cf6",
  },
  ballroom: {
    wall: "#3a1622",
    trim: "#d4a64a",
    floorA: "#2a0f18",
    floorB: "#14070c",
    line: "#5a2a1c",
    light: "#ffb347",
    sparkle: "#ffd9a0",
    sign: "#ffe2b0",
    glow: "#ff7a1a",
  },
};

const b = ROOM_BOUNDS;
const width = b.maxX - b.minX;
const depth = b.maxZ - b.minZ;
const WALL_H = 4.2;

function Walls({ theme }: { theme: Theme }) {
  const t = 0.8;
  return (
    <group>
      {[
        { p: [0, WALL_H / 2, b.minZ - t / 2], s: [width + 2 * t, WALL_H, t] },
        { p: [b.minX - t / 2, WALL_H / 2, 0], s: [t, WALL_H, depth] },
        { p: [b.maxX + t / 2, WALL_H / 2, 0], s: [t, WALL_H, depth] },
        // Low south wall so the follow camera can look in; the gap is the door.
        { p: [-(width / 4 + 0.9), 0.35, b.maxZ + t / 2], s: [width / 2 - 1.8 + t, 0.7, t] },
        { p: [width / 4 + 0.9, 0.35, b.maxZ + t / 2], s: [width / 2 - 1.8 + t, 0.7, t] },
      ].map(({ p, s }, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <boxGeometry args={s as [number, number, number]} />
          <meshStandardMaterial color={theme.wall} roughness={0.95} />
        </mesh>
      ))}
      {/* trim line on the three tall walls */}
      <mesh position={[0, 1.1, b.minZ + 0.02]}>
        <boxGeometry args={[width, 0.06, 0.05]} />
        <meshStandardMaterial color={theme.trim} metalness={0.4} roughness={0.5} />
      </mesh>
      {[b.minX + 0.02, b.maxX - 0.02].map((x) => (
        <mesh key={x} position={[x, 1.1, 0]}>
          <boxGeometry args={[0.05, 0.06, depth]} />
          <meshStandardMaterial color={theme.trim} metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function Floor({ theme }: { theme: Theme }) {
  const texture = useMemo(() => {
    const tex = makeCheckerTexture(theme.floorA, theme.floorB, theme.line);
    tex.repeat.set(width / 2.5, depth / 2.5);
    return tex;
  }, [theme]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width + 2, depth + 2]} />
        <meshStandardMaterial map={texture} roughness={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, b.maxZ + 6]}>
        <planeGeometry args={[width + 16, 12]} />
        <meshStandardMaterial color="#0d0914" roughness={1} />
      </mesh>
    </group>
  );
}

/** The long table: one chair per guest the room holds, a crystal ball in the middle. */
function Table({ theme, capacity }: { theme: Theme; capacity: number }) {
  const orb = useRef<THREE.Mesh>(null);
  const table = roomTable(capacity);
  useFrame(({ clock }) => {
    if (!orb.current) return;
    orb.current.position.y = 1.25 + Math.sin(clock.elapsedTime * 1.6) * 0.05;
    orb.current.rotation.y = clock.elapsedTime * 0.4;
  });
  return (
    <group>
      <LongTable table={table} palette={TABLE_PALETTES.room} />
      <group position={[0, 0, table.z]}>
        <mesh ref={orb} position={[0, 1.25, 0]}>
          <icosahedronGeometry args={[0.24, 1]} />
          <meshStandardMaterial color={theme.glow} emissive={theme.glow} emissiveIntensity={1.4} transparent opacity={0.85} flatShading />
        </mesh>
        <mesh position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.16, 0.22, 0.1, 6]} />
          <meshStandardMaterial color={theme.trim} metalness={0.6} roughness={0.4} />
        </mesh>
        <pointLight position={[0, 1.8, 0]} color={theme.light} intensity={8} distance={8} decay={1.5} />
      </group>
    </group>
  );
}

function Coffin({ x, z, rotation }: { x: number; z: number; rotation: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.3, 0]} scale={[0.7, 0.6, 1.9]}>
        <cylinderGeometry args={[0.5, 0.42, 1, 6]} />
        <meshStandardMaterial color="#2a1a12" flatShading />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <boxGeometry args={[0.08, 0.02, 0.6]} />
        <meshStandardMaterial color="#c9b98f" />
      </mesh>
      <mesh position={[0, 0.62, -0.15]}>
        <boxGeometry args={[0.32, 0.02, 0.08]} />
        <meshStandardMaterial color="#c9b98f" />
      </mesh>
    </group>
  );
}

function Bookshelf({ x, z, rotation, theme }: { x: number; z: number; rotation: number; theme: Theme }) {
  const colors = ["#8b5cf6", "#c81d25", "#2ec4b6", "#e9d8a6", "#ff7a1a", "#3f7d20"];
  return (
    <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
      <mesh position={[0, 1.3, 0]}>
        <boxGeometry args={[1.6, 2.6, 0.5]} />
        <meshStandardMaterial color="#26160e" flatShading />
      </mesh>
      {[0.5, 1.15, 1.8].map((y) =>
        Array.from({ length: 7 }, (_, i) => (
          <mesh key={`${y}-${i}`} position={[-0.6 + i * 0.2, y + 0.18, 0.12]} rotation={[0, 0, (i % 3) * 0.05]}>
            <boxGeometry args={[0.14, 0.42 - (i % 2) * 0.08, 0.3]} />
            <meshStandardMaterial color={colors[(i + Math.round(y * 3)) % colors.length]} flatShading />
          </mesh>
        )),
      )}
      <mesh position={[0, 2.66, 0]}>
        <boxGeometry args={[1.7, 0.1, 0.56]} />
        <meshStandardMaterial color={theme.trim} />
      </mesh>
    </group>
  );
}

function Chandelier({ theme }: { theme: Theme }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = Math.sin(clock.elapsedTime * 0.3) * 0.15;
  });
  return (
    <group ref={group} position={[0, 3.6, -0.5]}>
      <mesh>
        <torusGeometry args={[0.9, 0.05, 4, 10]} />
        <meshStandardMaterial color={theme.trim} metalness={0.7} roughness={0.3} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.9, 0.12, Math.sin(a) * 0.9]}>
            <coneGeometry args={[0.04, 0.12, 5]} />
            <meshBasicMaterial color="#ffcf5a" toneMapped={false} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1.2, 4]} />
        <meshStandardMaterial color="#120a1a" />
      </mesh>
    </group>
  );
}

function RoomSign({ name, theme }: { name: string; theme: Theme }) {
  const texture = useLabelTexture(name, { font: "Creepster", size: 110, color: theme.sign, glow: theme.glow, width: 1024, height: 192 });
  return (
    <mesh position={[0, 3.2, b.minZ + 0.05]}>
      <planeGeometry args={[6.4, 1.2]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

/** The big screen on the north wall: shows the room's presentation (screen share or slides). */
function RoomScreen({ source }: { source: HTMLVideoElement | HTMLCanvasElement | null }) {
  const texture = useMemo(() => {
    if (!source) return null;
    const t = source instanceof HTMLVideoElement ? new THREE.VideoTexture(source) : new THREE.CanvasTexture(source);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [source]);
  useEffect(() => () => texture?.dispose(), [texture]);
  // Slides change by redrawing the canvas: refresh the texture now and then.
  useFrame(({ clock }) => {
    if (texture instanceof THREE.CanvasTexture && !(texture instanceof THREE.VideoTexture) && Math.floor(clock.elapsedTime * 4) % 2 === 0) texture.needsUpdate = true;
  });
  const w = 6.2;
  const h = 3.5;
  return (
    <group position={[0, 2.75, b.minZ + 0.12]}>
      <mesh position={[0, 0, -0.04]}>
        <boxGeometry args={[w + 0.3, h + 0.3, 0.06]} />
        <meshStandardMaterial color="#120a1a" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh>
        <planeGeometry args={[w, h]} />
        {texture ? <meshBasicMaterial map={texture} toneMapped={false} /> : <meshStandardMaterial color="#1a1026" emissive="#2b1d3a" emissiveIntensity={0.4} />}
      </mesh>
    </group>
  );
}

export function RoomInterior({
  name,
  decor,
  capacity,
  screen = null,
}: {
  name: string;
  decor: RoomDecor;
  capacity: number;
  screen?: HTMLVideoElement | HTMLCanvasElement | null;
}) {
  const theme = THEMES[decor];
  return (
    <group>
      {/* M18: brighter with ambient and hemisphere only; an extra point light slowed every material (see the M18 spec). */}
      <ambientLight intensity={1.6} color="#8a78b8" />
      <hemisphereLight args={[theme.light, "#120a1a", 1.2]} />
      <directionalLight position={[4, 10, 6]} intensity={0.9} color="#c9d4ff" />
      <Floor theme={theme} />
      <Walls theme={theme} />
      <RoomSign name={name} theme={theme} />
      <Table theme={theme} capacity={capacity} />
      {screen && <RoomScreen source={screen} />}
      {decor === "crypt" && (
        <>
          <Coffin x={-6.6} z={-4.6} rotation={0.4} />
          <Coffin x={6.6} z={-4.6} rotation={-0.4} />
          <Pumpkin position={[-7.2, 0, 4.8]} scale={0.8} rotationY={2.5} lit />
        </>
      )}
      {decor === "library" && (
        <>
          <Bookshelf x={-6.6} z={-4.9} rotation={0.6} theme={theme} />
          <Bookshelf x={6.6} z={-4.9} rotation={-0.6} theme={theme} />
          <Bookshelf x={-2.4} z={b.minZ + 0.3} rotation={0} theme={theme} />
          <Bookshelf x={2.4} z={b.minZ + 0.3} rotation={0} theme={theme} />
        </>
      )}
      {decor === "ballroom" && (
        <>
          <Chandelier theme={theme} />
          <Pumpkin position={[-6.6, 0, -4.6]} scale={1.6} rotationY={0.5} lit />
          <Pumpkin position={[6.6, 0, -4.6]} scale={1.6} rotationY={-0.5} lit />
        </>
      )}
      <Pumpkin position={[-1.6, 0, b.maxZ - 0.3]} scale={0.7} rotationY={Math.PI - 0.3} />
      <Pumpkin position={[1.6, 0, b.maxZ - 0.3]} scale={0.7} rotationY={Math.PI + 0.3} />
      <Sparkles count={45} scale={[width, 3.5, depth]} position={[0, 2, 0]} size={2.2} speed={0.3} opacity={0.6} color={theme.sparkle} />
    </group>
  );
}
