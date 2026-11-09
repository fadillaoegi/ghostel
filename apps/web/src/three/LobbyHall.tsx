import { LOBBY_BOUNDS, LOBBY_OBSTACLES } from "@ghostel/shared";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { makeCheckerTexture, useLabelTexture } from "./textures";

const WALL = "#2a1b3d";
const WAINSCOT = "#1a1026";
const TRIM = "#b88a3e";
const STONE = "#4b3f5c";
const WALL_HEIGHT = 5;

const b = LOBBY_BOUNDS;
const width = b.maxX - b.minX;
const depth = b.maxZ - b.minZ;

function Floor() {
  const texture = useMemo(() => {
    const t = makeCheckerTexture("#22163a", "#140c22", "#3a2a55");
    t.repeat.set(width / 3, depth / 3);
    return t;
  }, []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[width + 2, depth + 2]} />
        <meshStandardMaterial map={texture} roughness={0.55} metalness={0.1} />
      </mesh>
      {/* red carpet: front doors → fountain → reception */}
      {[
        [b.maxZ + 1, 2.3],
        [-2.3, -7.6],
      ].map(([from, to]) => {
        const len = (from as number) - (to as number);
        const z = ((from as number) + (to as number)) / 2;
        return (
          <group key={z} position={[0, 0.01, z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[3.2, len]} />
              <meshStandardMaterial color={TRIM} roughness={0.6} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
              <planeGeometry args={[2.8, len]} />
              <meshStandardMaterial color="#5c0f1f" roughness={0.9} />
            </mesh>
          </group>
        );
      })}
      {/* rug ring around the fountain */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[2.1, 3.1, 10]} />
        <meshStandardMaterial color="#5c0f1f" roughness={0.9} />
      </mesh>
    </group>
  );
}

function ArchedWindow({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh>
        <boxGeometry args={[1.7, 2.4, 0.08]} />
        <meshStandardMaterial color="#20304f" emissive="#6fa8ff" emissiveIntensity={0.55} flatShading />
      </mesh>
      <mesh position={[0, 1.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.85, 0.85, 0.08, 10, 1, false, -Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color="#20304f" emissive="#6fa8ff" emissiveIntensity={0.55} flatShading />
      </mesh>
      {/* frame bars */}
      <mesh position={[0, 0.3, 0.06]}>
        <boxGeometry args={[0.08, 3.2, 0.06]} />
        <meshStandardMaterial color={WAINSCOT} />
      </mesh>
      <mesh position={[0, 0.4, 0.06]}>
        <boxGeometry args={[1.7, 0.08, 0.06]} />
        <meshStandardMaterial color={WAINSCOT} />
      </mesh>
      <mesh position={[0, -1.25, 0.12]}>
        <boxGeometry args={[2, 0.12, 0.3]} />
        <meshStandardMaterial color={TRIM} />
      </mesh>
    </group>
  );
}

function Wall({ position, size }: { position: [number, number, number]; size: [number, number, number] }) {
  const [w, h, d] = size;
  return (
    <group position={position}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={WALL} roughness={0.95} />
      </mesh>
      {h > 1.5 && (
        <>
          <mesh position={[0, 0.6, 0]}>
            <boxGeometry args={[w + 0.06, 1.2, d + 0.06]} />
            <meshStandardMaterial color={WAINSCOT} roughness={0.8} />
          </mesh>
          <mesh position={[0, 1.22, 0]}>
            <boxGeometry args={[w + 0.1, 0.06, d + 0.1]} />
            <meshStandardMaterial color={TRIM} metalness={0.4} roughness={0.5} />
          </mesh>
        </>
      )}
    </group>
  );
}

function Pillar({ x, z, r }: { x: number; z: number; r: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[r * 2.4, 0.4, r * 2.4]} />
        <meshStandardMaterial color={STONE} flatShading />
      </mesh>
      <mesh position={[0, WALL_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[r * 0.85, r, WALL_HEIGHT, 6]} />
        <meshStandardMaterial color="#5a4c6e" flatShading roughness={0.9} />
      </mesh>
      <mesh position={[0, WALL_HEIGHT - 0.15, 0]}>
        <boxGeometry args={[r * 2.3, 0.3, r * 2.3]} />
        <meshStandardMaterial color={STONE} flatShading />
      </mesh>
      {/* wall lantern */}
      <group position={[0, 2.6, r + 0.15]}>
        <mesh>
          <boxGeometry args={[0.26, 0.38, 0.26]} />
          <meshStandardMaterial color="#120a1a" flatShading />
        </mesh>
        <mesh>
          <boxGeometry args={[0.2, 0.3, 0.28]} />
          <meshStandardMaterial color="#ffb347" emissive="#ff9a2e" emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

function Fountain({ r }: { r: number }) {
  const ghost = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ghost.current) {
      ghost.current.position.y = 1.75 + Math.sin(t * 1.4) * 0.15;
      ghost.current.rotation.y = t * 0.5;
    }
    if (light.current) light.current.intensity = 9 + Math.sin(t * 3) * 1.5;
  });
  return (
    <group>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[r, r + 0.15, 0.6, 10]} />
        <meshStandardMaterial color={STONE} flatShading />
      </mesh>
      <mesh position={[0, 0.56, 0]}>
        <cylinderGeometry args={[r - 0.22, r - 0.22, 0.05, 10]} />
        <meshStandardMaterial color="#2bd98f" emissive="#43ffb0" emissiveIntensity={0.9} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.18, 0.3, 0.7, 6]} />
        <meshStandardMaterial color={STONE} flatShading />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.65, 0.45, 0.15, 8]} />
        <meshStandardMaterial color={STONE} flatShading />
      </mesh>
      <group ref={ghost}>
        <mesh position={[0, 0.25, 0]}>
          <coneGeometry args={[0.38, 0.75, 8, 1, true]} />
          <meshStandardMaterial color="#f4f1de" emissive="#9affd6" emissiveIntensity={0.5} side={THREE.DoubleSide} flatShading />
        </mesh>
        <mesh position={[0, 0.55, 0]}>
          <icosahedronGeometry args={[0.24, 1]} />
          <meshStandardMaterial color="#f4f1de" emissive="#9affd6" emissiveIntensity={0.5} flatShading />
        </mesh>
        {[-0.08, 0.08].map((x) => (
          <mesh key={x} position={[x, 0.58, 0.21]}>
            <icosahedronGeometry args={[0.04, 0]} />
            <meshBasicMaterial color="#1a1024" />
          </mesh>
        ))}
      </group>
      <pointLight ref={light} position={[0, 1.4, 0]} color="#43ffb0" intensity={9} distance={9} decay={1.6} />
    </group>
  );
}

function Reception({ minX, maxX, minZ, maxZ }: { minX: number; maxX: number; minZ: number; maxZ: number }) {
  const w = maxX - minX;
  const d = maxZ - minZ;
  const z = (minZ + maxZ) / 2;
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[w, 1.1, d]} />
        <meshStandardMaterial color="#3b2416" flatShading roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.13, 0]}>
        <boxGeometry args={[w + 0.2, 0.08, d + 0.2]} />
        <meshStandardMaterial color="#5a3a22" flatShading />
      </mesh>
      <mesh position={[0, 0.55, d / 2 + 0.01]}>
        <planeGeometry args={[w - 0.6, 0.7]} />
        <meshStandardMaterial color="#26160e" />
      </mesh>
      {/* bell */}
      <mesh position={[1.6, 1.22, 0.2]}>
        <sphereGeometry args={[0.12, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={TRIM} metalness={0.7} roughness={0.3} />
      </mesh>
      {/* key board behind the desk */}
      <mesh position={[0, 2.2, -d / 2 - 0.25]}>
        <boxGeometry args={[4, 1.4, 0.1]} />
        <meshStandardMaterial color="#26160e" />
      </mesh>
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} position={[-1.6 + (i % 5) * 0.8, 2.45 - Math.floor(i / 5) * 0.55, -d / 2 - 0.18]}>
          <boxGeometry args={[0.12, 0.3, 0.04]} />
          <meshStandardMaterial color={TRIM} metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function HotelSign() {
  const texture = useLabelTexture("Ghostel", {
    font: "Creepster",
    size: 190,
    color: "#ffcf7a",
    glow: "#ff7a1a",
    width: 1024,
    height: 256,
  });
  return (
    <mesh position={[0, 3.95, b.minZ + 0.06]}>
      <planeGeometry args={[6.4, 1.6]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

function Tombstone({ x, z, tilt }: { x: number; z: number; tilt: number }) {
  return (
    <group position={[x, 0, z]} rotation={[tilt * 0.15, tilt, tilt * 0.1]}>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.7, 0.9, 0.18]} />
        <meshStandardMaterial color="#5a5470" flatShading />
      </mesh>
      <mesh position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 0.18, 8, 1, false, -Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color="#5a5470" flatShading />
      </mesh>
      <mesh position={[0, 0.6, 0.1]}>
        <boxGeometry args={[0.32, 0.06, 0.02]} />
        <meshStandardMaterial color="#2a2438" />
      </mesh>
    </group>
  );
}

function LampPost({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.06, 0.09, 2.8, 6]} />
        <meshStandardMaterial color="#120a1a" flatShading />
      </mesh>
      <mesh position={[0, 2.95, 0]}>
        <boxGeometry args={[0.32, 0.4, 0.32]} />
        <meshStandardMaterial color="#ffb347" emissive="#ff9a2e" emissiveIntensity={2.2} toneMapped={false} />
      </mesh>
      <mesh position={[0, 3.25, 0]}>
        <coneGeometry args={[0.28, 0.25, 4]} />
        <meshStandardMaterial color="#120a1a" flatShading />
      </mesh>
    </group>
  );
}

/** Front porch and a small graveyard south of the hall, so the follow camera never looks into a void. */
function Porch() {
  const porchDepth = 14;
  const z = b.maxZ + 1 + porchDepth / 2;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, z]}>
        <planeGeometry args={[width + 24, porchDepth]} />
        <meshStandardMaterial color="#120d1c" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, z]}>
        <planeGeometry args={[3.6, porchDepth]} />
        <meshStandardMaterial color="#2c2440" roughness={0.9} />
      </mesh>
      <LampPost x={-3.2} z={b.maxZ + 3.5} />
      <LampPost x={3.2} z={b.maxZ + 3.5} />
      <pointLight position={[0, 2.6, b.maxZ + 3.5]} color="#ff9a2e" intensity={5} distance={9} decay={1.6} />
      <Tombstone x={-7} z={b.maxZ + 3} tilt={0.2} />
      <Tombstone x={-9.5} z={b.maxZ + 5.5} tilt={-0.25} />
      <Tombstone x={-5.5} z={b.maxZ + 6.5} tilt={0.1} />
      <Tombstone x={7.5} z={b.maxZ + 3.2} tilt={-0.15} />
      <Tombstone x={10} z={b.maxZ + 6} tilt={0.3} />
      <Tombstone x={6} z={b.maxZ + 7} tilt={-0.05} />
    </group>
  );
}

export function LobbyHall() {
  const t = 1; // wall thickness
  return (
    <group>
      <Floor />
      <Porch />
      {/* north, west, east walls are full height; south is a low balustrade so the camera can see in */}
      <Wall position={[0, 0, b.minZ - t / 2]} size={[width + 2 * t, WALL_HEIGHT, t]} />
      <Wall position={[b.minX - t / 2, 0, 0]} size={[t, WALL_HEIGHT, depth]} />
      <Wall position={[b.maxX + t / 2, 0, 0]} size={[t, WALL_HEIGHT, depth]} />
      {[-1, 1].map((side) => (
        <Wall key={side} position={[side * (width / 4 + 1.1), 0, b.maxZ + t / 2]} size={[width / 2 - 2.2 + t, 0.7, t]} />
      ))}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 1.75, 0, b.maxZ + 0.5]}>
          <mesh position={[0, 1.1, 0]}>
            <boxGeometry args={[0.5, 2.2, 0.5]} />
            <meshStandardMaterial color={STONE} flatShading />
          </mesh>
          <mesh position={[0, 2.4, 0]}>
            <icosahedronGeometry args={[0.28, 0]} />
            <meshStandardMaterial color="#ffb347" emissive="#ff9a2e" emissiveIntensity={2} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {[-10, -5.5, 5.5, 10].map((x) => (
        <ArchedWindow key={x} position={[x, 2.6, b.minZ + 0.05]} />
      ))}
      {[-6, 6].map((z) => (
        <ArchedWindow key={`w${z}`} position={[b.minX + 0.05, 2.6, z]} rotationY={Math.PI / 2} />
      ))}
      {[-6, 6].map((z) => (
        <ArchedWindow key={`e${z}`} position={[b.maxX - 0.05, 2.6, z]} rotationY={-Math.PI / 2} />
      ))}
      <HotelSign />

      {LOBBY_OBSTACLES.map((o, i) => {
        if (o.kind === "circle" && o.label === "pillar") return <Pillar key={i} x={o.x} z={o.z} r={o.r} />;
        if (o.kind === "circle" && o.label === "fountain") return <Fountain key={i} r={o.r} />;
        if (o.kind === "box" && o.label === "reception") return <Reception key={i} {...o} />;
        return null;
      })}
    </group>
  );
}
