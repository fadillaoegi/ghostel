import { useMemo } from "react";
import * as THREE from "three";
import { SIGN } from "../timeline";
import { canvasTexture, drawSignCanvas, glowTexture } from "./textures";

/**
 * The neon "GHOSTEL" sign. `brightness` 0–1 (0 = hidden), so it can ignite and flicker. `backing` 0–1 darkens
 * the hotel windows behind the letters, so the sign stays easy to read.
 */
export function Sign({ brightness, backing = brightness > 0 ? 1 : 0 }: { brightness: number; backing?: number }) {
  const texture = useMemo(() => canvasTexture(drawSignCanvas(true)), []);
  const halo = useMemo(() => glowTexture("rgba(255,122,26,0.8)"), []);
  const shade = useMemo(() => glowTexture("rgba(8,4,14,1)", "rgba(8,4,14,0)"), []);
  return (
    <group position={[0, SIGN.y, SIGN.z]}>
      {backing > 0 ? (
        <mesh position={[0, 0, -0.5]} renderOrder={-1}>
          <planeGeometry args={[SIGN.width * 1.9, SIGN.height * 3.2]} />
          <meshBasicMaterial map={shade} transparent opacity={0.92 * Math.min(1, backing)} depthWrite={false} fog={false} />
        </mesh>
      ) : null}
      {brightness > 0 ? (
        <>
          <sprite position={[0, 0, -0.2]} scale={[SIGN.width * 1.5, SIGN.height * 2.4, 1]}>
            <spriteMaterial map={halo} transparent opacity={0.45 * brightness} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </sprite>
          <mesh>
            <planeGeometry args={[SIGN.width, SIGN.height]} />
            <meshBasicMaterial map={texture} transparent opacity={brightness} depthWrite={false} toneMapped={false} />
          </mesh>
          <pointLight position={[0, 0, 1.4]} color="#ff9a2e" intensity={18 * brightness} distance={12} decay={1.5} />
        </>
      ) : null}
    </group>
  );
}

/** An expanding ring of light where the pumpkin bursts. */
export function Shockwave({ progress, position }: { progress: number; position: [number, number, number] }) {
  if (progress <= 0 || progress >= 1) return null;
  const r = 0.4 + progress * 7;
  return (
    <mesh position={position}>
      <ringGeometry args={[r * 0.86, r, 48]} />
      <meshBasicMaterial color="#ffcf5a" transparent opacity={(1 - progress) * 0.8} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  );
}
