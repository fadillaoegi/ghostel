import type { FloorNumber } from "@ghostel/shared";
import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import * as THREE from "three";
import { useLabelTexture } from "./textures";

const BRASS = "#c9a227";

/**
 * Art-deco elevator door. `facing` is the direction the door looks into the room:
 * a door on the north wall faces +z, one on the west wall faces +x. Doors slide open when a guest is near.
 */
export function Elevator({
  x,
  z,
  facing,
  floor,
  selfPos,
}: {
  x: number;
  z: number;
  facing: "north" | "west";
  floor: FloorNumber;
  selfPos: RefObject<{ x: number; z: number }>;
}) {
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const open = useRef(0);
  const sign = useLabelTexture(`${floor}`, { font: "Creepster", size: 120, color: "#ffe2b0", glow: "#ff9a2e", width: 192, height: 160 });
  const label = useLabelTexture("ELEVATOR", { font: "Nunito", size: 44, color: "#ffe2b0", glow: "#ff9a2e", width: 384, height: 72 });

  useFrame((state, dt) => {
    const me = selfPos.current;
    const near = me ? Math.hypot(me.x - x, me.z - z) < 2.6 : false;
    open.current += ((near ? 1 : 0) - open.current) * (1 - Math.exp(-Math.min(dt, 0.1) * 6));
    const slide = open.current * 0.62;
    if (left.current) left.current.position.x = -0.32 - slide;
    if (right.current) right.current.position.x = 0.32 + slide;
    if (glow.current) glow.current.emissiveIntensity = 0.6 + open.current * 1.6 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
  });

  const rotationY = facing === "north" ? 0 : Math.PI / 2;
  const px = facing === "north" ? x : x + 0.06;
  const pz = facing === "north" ? z + 0.06 : z;

  return (
    <group position={[px, 0, pz]} rotation={[0, rotationY, 0]}>
      {/* lit cabin behind the doors */}
      <mesh position={[0, 1.4, -0.05]}>
        <planeGeometry args={[1.3, 2.6]} />
        <meshStandardMaterial ref={glow} color="#3a2a12" emissive="#ffcf7a" emissiveIntensity={0.6} />
      </mesh>
      <mesh ref={left} position={[-0.32, 1.4, 0.02]}>
        <boxGeometry args={[0.64, 2.6, 0.05]} />
        <meshStandardMaterial color="#6b4e1f" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh ref={right} position={[0.32, 1.4, 0.02]}>
        <boxGeometry args={[0.64, 2.6, 0.05]} />
        <meshStandardMaterial color="#6b4e1f" metalness={0.7} roughness={0.35} />
      </mesh>
      {/* frame */}
      {[-0.78, 0.78].map((fx) => (
        <mesh key={fx} position={[fx, 1.5, 0.05]}>
          <boxGeometry args={[0.18, 3, 0.16]} />
          <meshStandardMaterial color={BRASS} metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 2.95, 0.05]}>
        <boxGeometry args={[1.75, 0.2, 0.16]} />
        <meshStandardMaterial color={BRASS} metalness={0.8} roughness={0.3} />
      </mesh>
      {/* floor indicator fan */}
      <mesh position={[0, 3.45, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.06, 12, 1, false, -Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color="#2a1a08" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 3.32, 0.1]}>
        <planeGeometry args={[0.6, 0.5]} />
        <meshBasicMaterial map={sign} transparent toneMapped={false} />
      </mesh>
      <mesh position={[0, 3.02, 0.14]}>
        <planeGeometry args={[1.2, 0.22]} />
        <meshBasicMaterial map={label} transparent toneMapped={false} />
      </mesh>
      {/* call button */}
      <mesh position={[1.02, 1.3, 0.05]}>
        <boxGeometry args={[0.16, 0.3, 0.05]} />
        <meshStandardMaterial color={BRASS} metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[1.02, 1.3, 0.09]}>
        <sphereGeometry args={[0.04, 8, 6]} />
        <meshBasicMaterial color="#ff9a2e" toneMapped={false} />
      </mesh>
    </group>
  );
}
