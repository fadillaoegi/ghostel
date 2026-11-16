import { useMemo } from "react";
import * as THREE from "three";
import { PALETTE, glowTexture } from "./textures";
import type { Vec3 } from "./textPoints";

/** A friendly sheet ghost, like the lobby NPCs, floating with a slow bob. */
export function Ghost({ frame, position, opacity }: { frame: number; position: Vec3; opacity: number }) {
  const glow = useMemo(() => glowTexture("rgba(190,255,230,0.6)"), []);
  if (opacity <= 0) return null;
  const bob = Math.sin(frame * 0.09) * 0.18;
  return (
    <group position={[position[0], position[1] + bob, position[2]]} rotation={[0, Math.sin(frame * 0.04) * 0.4, Math.sin(frame * 0.07) * 0.08]}>
      <mesh position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.34, 10, 8]} />
        <meshStandardMaterial color={PALETTE.ghost} emissive="#cfe9df" emissiveIntensity={0.55} transparent opacity={opacity * 0.92} flatShading />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <coneGeometry args={[0.42, 0.95, 9, 1, true]} />
        <meshStandardMaterial color={PALETTE.ghost} emissive="#cfe9df" emissiveIntensity={0.45} transparent opacity={opacity * 0.85} side={THREE.DoubleSide} flatShading />
      </mesh>
      {[-0.11, 0.11].map((x) => (
        <mesh key={x} position={[x, 0.6, 0.3]}>
          <sphereGeometry args={[0.05, 6, 4]} />
          <meshBasicMaterial color="#1a0f24" transparent opacity={opacity} />
        </mesh>
      ))}
      <sprite position={[0, 0.4, 0]} scale={[2.2, 2.2, 1]}>
        <spriteMaterial map={glow} transparent opacity={opacity * 0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </group>
  );
}
