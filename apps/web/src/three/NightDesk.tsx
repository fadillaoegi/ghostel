import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { useLabelTexture } from "./textures";

const WOOD = "#5a3a22";
const WOOD_DARK = "#3b2416";
const BAKELITE = "#2b2633";
const PHOSPHOR = "#7dff9a";

/**
 * The Night Desk: a 1987 hotel terminal on a small desk (M16). The walkable footprint is the
 * `night-desk` obstacle in `packages/shared/src/layout.ts`; this only draws it. Everything stays
 * below the window sill behind it (y ≈ 1.33).
 */
export function NightDeskModel({ minX, maxX, maxZ }: { minX: number; maxX: number; maxZ: number }) {
  const cursor = useRef<THREE.MeshBasicMaterial>(null);
  const screenText = useLabelTexture("GUEST LOGIN", { font: "VT323", size: 104, color: PHOSPHOR, glow: "#22ff66", width: 512, height: 160 });
  const plaque = useLabelTexture("Night Desk", { font: "Creepster", size: 84, color: "#b8ffc8", glow: "#22ff66", width: 512, height: 120 });
  useFrame(({ clock }) => {
    // A slow, soft cursor pulse (no hard blinking).
    if (cursor.current) cursor.current.opacity = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 3.2));
  });
  const w = maxX - minX;
  const x = (minX + maxX) / 2;
  // The desk stands against the wall (z = -10); its front edge is the obstacle's south side.
  const depth = 0.8;
  const z = maxZ - depth / 2;
  const top = 0.68;
  return (
    <group position={[x, 0, z]}>
      {/* desk */}
      <mesh position={[0, top, 0]}>
        <boxGeometry args={[w, 0.08, depth]} />
        <meshStandardMaterial color={WOOD} flatShading />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (w / 2 - 0.08), (top - 0.04) / 2, sz * (depth / 2 - 0.08)]}>
            <boxGeometry args={[0.08, top - 0.04, 0.08]} />
            <meshStandardMaterial color={WOOD_DARK} flatShading />
          </mesh>
        )),
      )}
      <mesh position={[0, 0.42, -depth / 2 + 0.05]}>
        <boxGeometry args={[w - 0.12, 0.46, 0.04]} />
        <meshStandardMaterial color={WOOD_DARK} flatShading />
      </mesh>
      {/* front apron with a glowing plaque */}
      <mesh position={[0, top - 0.13, depth / 2 - 0.03]}>
        <boxGeometry args={[w - 0.04, 0.18, 0.04]} />
        <meshStandardMaterial color={WOOD_DARK} flatShading />
      </mesh>
      <mesh position={[0, top - 0.13, depth / 2 - 0.005]}>
        <planeGeometry args={[0.95, 0.22]} />
        <meshBasicMaterial map={plaque} transparent toneMapped={false} />
      </mesh>

      {/* CRT monitor, a little larger than life so it reads from the follow camera */}
      <group position={[0, top + 0.04, -0.06]} scale={1.15}>
        <mesh position={[0, 0.25, 0]}>
          <boxGeometry args={[0.64, 0.5, 0.46]} />
          <meshStandardMaterial color={BAKELITE} roughness={0.6} flatShading />
        </mesh>
        <mesh position={[0, 0.23, -0.3]}>
          <boxGeometry args={[0.44, 0.36, 0.2]} />
          <meshStandardMaterial color={BAKELITE} roughness={0.6} flatShading />
        </mesh>
        {/* screen: dark glass, text, cursor */}
        <mesh position={[0, 0.27, 0.232]}>
          <planeGeometry args={[0.52, 0.36]} />
          <meshBasicMaterial color="#052e14" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.31, 0.236]}>
          <planeGeometry args={[0.46, 0.144]} />
          <meshBasicMaterial map={screenText} transparent toneMapped={false} />
        </mesh>
        <mesh position={[-0.17, 0.18, 0.236]}>
          <planeGeometry args={[0.05, 0.03]} />
          <meshBasicMaterial ref={cursor} color={PHOSPHOR} transparent toneMapped={false} />
        </mesh>
        {/* power light */}
        <mesh position={[0.25, 0.04, 0.235]}>
          <sphereGeometry args={[0.012, 6, 4]} />
          <meshBasicMaterial color="#ff4d4d" toneMapped={false} />
        </mesh>
      </group>
      {/* keyboard */}
      <mesh position={[0, top + 0.06, 0.27]} rotation={[0.08, 0, 0]}>
        <boxGeometry args={[0.6, 0.035, 0.18]} />
        <meshStandardMaterial color="#b9ae94" flatShading />
      </mesh>
      {/* No point light (M19): the screen is meshBasicMaterial and glows by itself; each point light costs every lit pixel. */}
    </group>
  );
}
