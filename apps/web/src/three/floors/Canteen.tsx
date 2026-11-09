import { CANTEEN_BOUNDS, CANTEEN_COUNTER, FLOOR_TABLES, SNACKS } from "@ghostel/shared";
import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Bat, Pumpkin } from "../Decor";
import { TABLE_PALETTES, Tables } from "../Tables";
import { makeCheckerTexture, useLabelTexture } from "../textures";

const b = CANTEEN_BOUNDS;
const W = b.maxX - b.minX;
const D = b.maxZ - b.minZ;
const WALL_H = 5;
const WALL = "#3a1f2e";
const CHROME = "#c9ccd6";
const RED = "#c81d25";

/** The menu board: drawn once on a canvas when the fonts are ready. */
function useMenuTexture(): THREE.CanvasTexture {
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 768;
    c.height = 512;
    return c;
  }, []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [canvas]);
  const [, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const draw = () => {
      if (cancelled) return;
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      ctx.fillStyle = "#121a14";
      ctx.fillRect(0, 0, 768, 512);
      ctx.strokeStyle = "#c9a227";
      ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, 754, 498);
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffcf7a";
      ctx.shadowColor = "#ff7a1a";
      ctx.shadowBlur = 16;
      ctx.font = "78px Creepster";
      ctx.fillText("MIDNIGHT MENU", 384, 96);
      ctx.shadowBlur = 0;
      ctx.font = "40px Nunito";
      ctx.textAlign = "left";
      SNACKS.forEach((s, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        ctx.fillStyle = "#f4f1de";
        ctx.fillText(`${s.emoji} ${s.name}`, 48 + col * 360, 190 + row * 104);
      });
      texture.needsUpdate = true;
      setVersion((v) => v + 1);
    };
    draw();
    Promise.all([document.fonts.load("78px Creepster"), document.fonts.load("40px Nunito")]).then(draw, draw);
    return () => {
      cancelled = true;
    };
  }, [canvas, texture]);
  return texture;
}

/** The cook's soup pot on the counter, bubbling green. */
function SoupPot({ x, z }: { x: number; z: number }) {
  const bubbles = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = bubbles.current;
    if (!g) return;
    g.children.forEach((child, i) => {
      const t = (clock.elapsedTime * 0.8 + i * 0.37) % 1;
      child.position.y = 0.05 + t * 0.35;
      child.scale.setScalar(1 - t * 0.7);
    });
  });
  return (
    <group position={[x, 1.12, z]}>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.42, 0.36, 0.5, 10]} />
        <meshStandardMaterial color="#2a2438" metalness={0.6} roughness={0.4} flatShading />
      </mesh>
      <mesh position={[0, 0.48, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.38, 12]} />
        <meshStandardMaterial color="#7ed957" emissive="#3fbf3f" emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
      <group ref={bubbles} position={[0, 0.45, 0]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[Math.sin(i * 2.1) * 0.2, 0, Math.cos(i * 2.1) * 0.2]}>
            <sphereGeometry args={[0.05, 6, 4]} />
            <meshStandardMaterial color="#b6ff8a" emissive="#7ed957" emissiveIntensity={0.8} transparent opacity={0.8} />
          </mesh>
        ))}
      </group>
      <pointLight position={[0, 0.9, 0.3]} color="#7ed957" intensity={3} distance={4} decay={1.8} />
    </group>
  );
}

function HangingLamp({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 4.2, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 1.6, 4]} />
        <meshStandardMaterial color="#120a1a" />
      </mesh>
      <mesh position={[0, 3.35, 0]}>
        <coneGeometry args={[0.36, 0.3, 8, 1, true]} />
        <meshStandardMaterial color={RED} side={THREE.DoubleSide} flatShading />
      </mesh>
      <mesh position={[0, 3.25, 0]}>
        <sphereGeometry args={[0.12, 8, 6]} />
        <meshBasicMaterial color="#ffe2b0" toneMapped={false} />
      </mesh>
    </group>
  );
}

function NightWindow({ x, z, rotationY }: { x: number; z: number; rotationY: number }) {
  return (
    <group position={[x, 2.7, z]} rotation={[0, rotationY, 0]}>
      <mesh>
        <boxGeometry args={[2.2, 2.4, 0.08]} />
        <meshStandardMaterial color="#1b2340" emissive="#4f6fbf" emissiveIntensity={0.45} />
      </mesh>
      {/* far city lights seen through the glass */}
      {[-0.7, -0.3, 0.2, 0.6].map((wx, i) => (
        <mesh key={wx} position={[wx, -0.7 + (i % 2) * 0.25, 0.05]}>
          <planeGeometry args={[0.28, 0.5 + (i % 3) * 0.25]} />
          <meshBasicMaterial color="#ffcf7a" transparent opacity={0.35} />
        </mesh>
      ))}
      <mesh position={[0, 0, 0.06]}>
        <boxGeometry args={[0.07, 2.4, 0.04]} />
        <meshStandardMaterial color={CHROME} metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.2, 0.06]}>
        <boxGeometry args={[2.2, 0.07, 0.04]} />
        <meshStandardMaterial color={CHROME} metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Counter() {
  const c = CANTEEN_COUNTER;
  const w = c.maxX - c.minX;
  const cx = (c.minX + c.maxX) / 2;
  return (
    <group>
      {/* front bar */}
      <mesh position={[cx, 0.55, c.maxZ - 0.35]}>
        <boxGeometry args={[w, 1.1, 0.7]} />
        <meshStandardMaterial color={RED} roughness={0.5} flatShading />
      </mesh>
      <mesh position={[cx, 1.12, c.maxZ - 0.35]}>
        <boxGeometry args={[w + 0.1, 0.06, 0.8]} />
        <meshStandardMaterial color={CHROME} metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[cx, 0.3, c.maxZ + 0.01]}>
        <boxGeometry args={[w, 0.08, 0.02]} />
        <meshStandardMaterial color={CHROME} metalness={0.8} roughness={0.25} />
      </mesh>
      {/* bar stools in front (decor; the order spot is in front of the middle) */}
      {[-3.5, -1.5, 5.5, 7.5].map((x) => (
        <group key={x} position={[x, 0, c.maxZ + 0.5]}>
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.05, 0.08, 0.7, 6]} />
            <meshStandardMaterial color={CHROME} metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.72, 0]}>
            <cylinderGeometry args={[0.24, 0.24, 0.09, 10]} />
            <meshStandardMaterial color={RED} />
          </mesh>
        </group>
      ))}
      {/* kitchen back wall with the serving hatch */}
      <mesh position={[cx, 1.6, b.minZ + 0.25]}>
        <boxGeometry args={[w, 3.2, 0.5]} />
        <meshStandardMaterial color="#5a4c3a" flatShading />
      </mesh>
      <mesh position={[cx + 3, 1.9, b.minZ + 0.51]}>
        <planeGeometry args={[3, 1]} />
        <meshStandardMaterial color="#ffb347" emissive="#ff9a2e" emissiveIntensity={0.9} />
      </mesh>
      <SoupPot x={-2.2} z={c.maxZ - 0.35} />
      <Pumpkin position={[6.8, 1.15, c.maxZ - 0.35]} scale={0.6} rotationY={0.4} />
      {/* order bell */}
      <mesh position={[2, 1.2, c.maxZ - 0.25]}>
        <sphereGeometry args={[0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#c9a227" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}

function Jukebox({ x, z }: { x: number; z: number }) {
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    glow.current?.emissive.setHSL((clock.elapsedTime * 0.08) % 1, 0.9, 0.45);
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[1, 1.6, 0.6]} />
        <meshStandardMaterial color="#4a2d1b" flatShading />
      </mesh>
      <mesh position={[0, 1.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.6, 12, 1, false, 0, Math.PI]} />
        <meshStandardMaterial ref={glow} color="#ff70a6" emissive="#ff70a6" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0, 0.9, 0.31]}>
        <planeGeometry args={[0.7, 0.5]} />
        <meshStandardMaterial color="#ffe2b0" emissive="#ffb347" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

export function Canteen() {
  const tiles = useMemo(() => {
    const t = makeCheckerTexture("#b9aa9c", "#241a2e", "#3a2a55");
    t.repeat.set(W / 1.6, D / 1.6);
    return t;
  }, []);
  const sign = useLabelTexture("Ghoul's Diner", { font: "Creepster", size: 120, color: "#ffd0e0", glow: "#ff3b7a", width: 1024, height: 180 });
  const menu = useMenuTexture();
  return (
    <group>
      <ambientLight intensity={0.9} color="#b49ad0" />
      <hemisphereLight args={["#ffd6e6", "#2a1530", 0.75]} />
      <directionalLight position={[4, 12, 10]} intensity={0.55} color="#ffe2c4" />
      {[-9, 0, 9].map((x) => (
        <pointLight key={x} position={[x, 3.4, 1]} intensity={10} distance={13} decay={1.5} color="#ffc47a" />
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W + 2, D + 2]} />
        <meshStandardMaterial map={tiles} roughness={0.45} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, b.maxZ + 6]}>
        <planeGeometry args={[W + 16, 12]} />
        <meshStandardMaterial color="#0d0914" />
      </mesh>
      {/* walls: north, west and east tall; south low so the camera can see in */}
      <mesh position={[0, WALL_H / 2, b.minZ - 0.4]}>
        <boxGeometry args={[W + 1.6, WALL_H, 0.8]} />
        <meshStandardMaterial color={WALL} roughness={0.95} />
      </mesh>
      {[b.minX - 0.4, b.maxX + 0.4].map((x) => (
        <mesh key={x} position={[x, WALL_H / 2, 0]}>
          <boxGeometry args={[0.8, WALL_H, D]} />
          <meshStandardMaterial color={WALL} roughness={0.95} />
        </mesh>
      ))}
      {/* chrome stripe along the walls, diner style */}
      <mesh position={[0, 1.1, b.minZ + 0.02]}>
        <boxGeometry args={[W, 0.12, 0.04]} />
        <meshStandardMaterial color={CHROME} metalness={0.8} roughness={0.3} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (W / 4 + 1), 0.35, b.maxZ + 0.4]}>
          <boxGeometry args={[W / 2 - 2, 0.7, 0.8]} />
          <meshStandardMaterial color={WALL} />
        </mesh>
      ))}
      {[-6, 0, 6].map((z) => (
        <NightWindow key={`w${z}`} x={b.minX + 0.05} z={z} rotationY={Math.PI / 2} />
      ))}
      {[-6, 0, 6].map((z) => (
        <NightWindow key={`e${z}`} x={b.maxX - 0.05} z={z} rotationY={-Math.PI / 2} />
      ))}
      <mesh position={[2, 4.45, b.minZ + 0.06]}>
        <planeGeometry args={[6.4, 1.12]} />
        <meshBasicMaterial map={sign} transparent toneMapped={false} />
      </mesh>
      <mesh position={[11.6, 2.9, b.minZ + 0.06]}>
        <planeGeometry args={[3.6, 2.4]} />
        <meshBasicMaterial map={menu} toneMapped={false} />
      </mesh>
      <Counter />
      <Tables tables={FLOOR_TABLES[4]} palette={TABLE_PALETTES.diner} />
      {FLOOR_TABLES[4]
        .filter((_, i) => i % 2 === 0)
        .map((t) => (
          <HangingLamp key={t.id} x={t.x} z={t.z} />
        ))}
      <Jukebox x={15.2} z={-10} />
      <Pumpkin position={[-15.2, 0, 10.2]} scale={1.1} rotationY={2.4} lit />
      <Pumpkin position={[15.2, 0, 10.2]} scale={1} rotationY={-2.4} />
      {[0, 1, 2].map((i) => (
        <Bat key={i} radius={5 + i * 2} height={4.2 + (i % 2) * 0.4} speed={0.25 + i * 0.05} offset={i * 2.1} />
      ))}
      <Sparkles count={30} scale={[W, 3, D]} position={[0, 2.4, 0]} size={2} speed={0.2} opacity={0.4} color="#ffd0e0" />
    </group>
  );
}
