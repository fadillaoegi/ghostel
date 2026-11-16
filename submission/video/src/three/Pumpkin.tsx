import { useMemo } from "react";
import * as THREE from "three";
import { PALETTE, glowTexture } from "./textures";

export const PEDESTAL_TOP = 1.2;
export const PUMPKIN_SCALE = 2.1;
/** Centre of the pumpkin body (where the shards start). */
export const PUMPKIN_CENTRE: [number, number, number] = [0, PEDESTAL_TOP + 0.3 * PUMPKIN_SCALE, 0];

/** Stone pedestal at the end of the path. */
export function Pedestal() {
  return (
    <group>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.9, 1.1, 1.0, 8]} />
        <meshStandardMaterial color={PALETTE.stone} flatShading />
      </mesh>
      <mesh position={[0, PEDESTAL_TOP - 0.1, 0]}>
        <cylinderGeometry args={[1.2, 1.2, 0.2, 8]} />
        <meshStandardMaterial color="#5a4c6e" flatShading />
      </mesh>
    </group>
  );
}

/**
 * The same carved jack-o'-lantern as in the lobby (Decor.tsx), scaled up. `charge` 0–1 shakes it and turns
 * the glow up before it bursts.
 */
export function Pumpkin({ frame, charge, visible }: { frame: number; charge: number; visible: boolean }) {
  const halo = useMemo(() => glowTexture("rgba(255,154,46,0.95)"), []);
  if (!visible) return null;
  const shake = charge * charge * 0.07;
  const sx = Math.sin(frame * 2.7) * shake;
  const sz = Math.cos(frame * 3.3) * shake;
  const swell = 1 + charge * 0.12 + Math.sin(frame * 1.9) * charge * 0.03;
  const light = 7 + charge * 40 + Math.sin(frame * 0.9) * 1.5;
  const FLAME = PALETTE.flame;
  return (
    <group position={[sx, PEDESTAL_TOP, sz]} scale={PUMPKIN_SCALE * swell}>
      <mesh position={[0, 0.3, 0]} scale={[1.2, 0.85, 1.2]}>
        <sphereGeometry args={[0.36, 9, 6]} />
        <meshStandardMaterial color={PALETTE.pumpkin} emissive={PALETTE.pumpkin} emissiveIntensity={0.15 + charge * 0.9} flatShading roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.66, 0]} rotation={[0.2, 0, 0.3]}>
        <cylinderGeometry args={[0.035, 0.06, 0.18, 5]} />
        <meshStandardMaterial color="#3f7d20" flatShading />
      </mesh>
      {[-0.13, 0.13].map((x) => (
        <mesh key={x} position={[x, 0.38, 0.39]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.07, 0.1, 3]} />
          <meshBasicMaterial color={FLAME} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, 0.2, 0.4]} scale={[1, 0.4, 0.3]}>
        <sphereGeometry args={[0.16, 6, 3, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshBasicMaterial color={FLAME} toneMapped={false} />
      </mesh>
      <sprite position={[0, 0.3, 0.3]} scale={[1.6 + charge * 1.8, 1.6 + charge * 1.8, 1]}>
        <spriteMaterial map={halo} transparent opacity={0.35 + charge * 0.6} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      <pointLight position={[0, 0.4, 0.6]} color={PALETTE.pumpkinGlow} intensity={light} distance={14} decay={1.5} />
    </group>
  );
}
