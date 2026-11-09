import type { SnackId } from "@ghostel/shared";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

/** The Diner snack a guest holds, drawn next to the right hand (avatar-local coordinates). */
export function Snack({ snack }: { snack: SnackId }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (group.current) group.current.position.y = 0.95 + Math.sin(clock.elapsedTime * 2.2) * 0.03;
  });
  return (
    <group ref={group} position={[-0.42, 0.95, 0.28]}>
      {snack === "pumpkin_pie" && (
        <group>
          <mesh>
            <cylinderGeometry args={[0.16, 0.13, 0.06, 10]} />
            <meshStandardMaterial color="#ff7a1a" flatShading />
          </mesh>
          <mesh position={[0, -0.035, 0]}>
            <cylinderGeometry args={[0.19, 0.19, 0.02, 12]} />
            <meshStandardMaterial color="#e9d8a6" />
          </mesh>
        </group>
      )}
      {snack === "eyeball_soda" && (
        <group>
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.07, 0.06, 0.24, 8]} />
            <meshStandardMaterial color="#7ed957" emissive="#3f7d20" emissiveIntensity={0.5} transparent opacity={0.85} />
          </mesh>
          <mesh position={[0, 0.19, 0]}>
            <sphereGeometry args={[0.055, 8, 6]} />
            <meshStandardMaterial color="#f4f1de" />
          </mesh>
          <mesh position={[0, 0.2, 0.045]}>
            <sphereGeometry args={[0.02, 6, 4]} />
            <meshBasicMaterial color="#2ec4b6" />
          </mesh>
          <mesh position={[0.03, 0.25, 0]} rotation={[0, 0, -0.3]}>
            <cylinderGeometry args={[0.008, 0.008, 0.2, 4]} />
            <meshStandardMaterial color="#c81d25" />
          </mesh>
        </group>
      )}
      {snack === "worm_noodles" && (
        <group>
          <mesh>
            <cylinderGeometry args={[0.15, 0.09, 0.12, 10, 1, true]} />
            <meshStandardMaterial color="#c81d25" side={THREE.DoubleSide} flatShading />
          </mesh>
          {[-0.05, 0.02, 0.07].map((x, i) => (
            <mesh key={x} position={[x, 0.07, (i - 1) * 0.04]} rotation={[Math.PI / 2, 0, i]}>
              <torusGeometry args={[0.05, 0.015, 5, 10, Math.PI * 1.4]} />
              <meshStandardMaterial color="#ff70a6" />
            </mesh>
          ))}
        </group>
      )}
      {snack === "ghost_marshmallow" && (
        <group>
          <mesh position={[0, 0.06, 0]}>
            <capsuleGeometry args={[0.07, 0.1, 4, 8]} />
            <meshStandardMaterial color="#f4f1de" emissive="#c4b5fd" emissiveIntensity={0.4} />
          </mesh>
          {[-0.025, 0.025].map((x) => (
            <mesh key={x} position={[x, 0.1, 0.065]}>
              <sphereGeometry args={[0.012, 5, 4]} />
              <meshBasicMaterial color="#1a1024" />
            </mesh>
          ))}
          <mesh position={[0, -0.12, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.2, 4]} />
            <meshStandardMaterial color="#e9d8a6" />
          </mesh>
        </group>
      )}
      {snack === "brain_jelly" && (
        <group>
          <mesh position={[0, 0.04, 0]} scale={[1, 0.75, 1.2]}>
            <sphereGeometry args={[0.11, 10, 8]} />
            <meshStandardMaterial color="#ff70a6" transparent opacity={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0, -0.04, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 0.02, 12]} />
            <meshStandardMaterial color="#e9d8a6" />
          </mesh>
        </group>
      )}
      {snack === "bat_cookie" && (
        <group rotation={[Math.PI / 2.4, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.07, 0.07, 0.025, 8]} />
            <meshStandardMaterial color="#4a2d1b" flatShading />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.1, 0, 0]} rotation={[0, side * 0.3, 0]}>
              <boxGeometry args={[0.11, 0.022, 0.07]} />
              <meshStandardMaterial color="#4a2d1b" flatShading />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}
