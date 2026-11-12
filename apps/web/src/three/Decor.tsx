import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { makeGlowTexture } from "./textures";

const FLAME = "#ffcf5a";

/** Carved jack-o'-lantern. `lit` adds a flickering point light (keep the count low for phones). */
export function Pumpkin({
  position,
  scale = 1,
  rotationY = 0,
  lit = false,
}: {
  position: [number, number, number];
  scale?: number;
  rotationY?: number;
  lit?: boolean;
}) {
  const light = useRef<THREE.PointLight>(null);
  const seed = useMemo(() => Math.random() * 100, []);
  useFrame(({ clock }) => {
    if (!light.current) return;
    const t = clock.elapsedTime + seed;
    light.current.intensity = 4 + Math.sin(t * 9) * 0.6 + Math.sin(t * 23) * 0.4;
  });
  return (
    <group position={position} scale={scale} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.3, 0]} scale={[1.2, 0.85, 1.2]}>
        <sphereGeometry args={[0.36, 9, 6]} />
        <meshStandardMaterial color="#ff7a1a" flatShading roughness={0.7} />
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
      {lit && <pointLight ref={light} position={[0, 0.5, 0.5]} color="#ff9a2e" intensity={4} distance={6} decay={1.8} />}
    </group>
  );
}

export function Candle({ position, height = 0.35 }: { position: [number, number, number]; height?: number }) {
  const flame = useRef<THREE.Mesh>(null);
  const seed = useMemo(() => Math.random() * 100, []);
  useFrame(({ clock }) => {
    if (!flame.current) return;
    const t = clock.elapsedTime + seed;
    flame.current.scale.y = 1 + Math.sin(t * 13) * 0.18;
    flame.current.rotation.z = Math.sin(t * 7) * 0.12;
  });
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.05, 0.055, height, 6]} />
        <meshStandardMaterial color="#efe6cf" flatShading />
      </mesh>
      <mesh ref={flame} position={[0, height + 0.06, 0]}>
        <coneGeometry args={[0.035, 0.12, 5]} />
        <meshBasicMaterial color={FLAME} toneMapped={false} />
      </mesh>
    </group>
  );
}

function CandleCluster({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <Candle position={[0, 0, 0]} height={0.45} />
      <Candle position={[0.14, 0, 0.08]} height={0.3} />
      <Candle position={[-0.1, 0, 0.12]} height={0.22} />
    </group>
  );
}

export function Bat({ radius, height, speed, offset }: { radius: number; height: number; speed: number; offset: number }) {
  const group = useRef<THREE.Group>(null);
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  const wing = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.45, 0.12);
    shape.lineTo(0.38, -0.02);
    shape.lineTo(0.28, 0.04);
    shape.lineTo(0.2, -0.06);
    shape.lineTo(0.08, 0);
    shape.lineTo(0, -0.08);
    return new THREE.ShapeGeometry(shape);
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed + offset;
    if (group.current) {
      group.current.position.set(Math.cos(t) * radius, height + Math.sin(t * 2.3) * 0.5, Math.sin(t) * radius * 0.7);
      group.current.rotation.y = -t + Math.PI;
    }
    const flap = Math.sin(clock.elapsedTime * 16 + offset) * 0.8;
    if (left.current) left.current.rotation.x = flap;
    if (right.current) right.current.rotation.x = flap;
  });
  return (
    <group ref={group}>
      <mesh>
        <icosahedronGeometry args={[0.08, 0]} />
        <meshStandardMaterial color="#120a1a" flatShading />
      </mesh>
      <group rotation={[Math.PI / 2, 0, 0]}>
        <mesh ref={right} geometry={wing}>
          <meshStandardMaterial color="#1a1024" side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={left} geometry={wing} scale={[-1, 1, 1]}>
          <meshStandardMaterial color="#1a1024" side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

export function Moon({ position = [9, 15, -30], size = 3.2 }: { position?: [number, number, number]; size?: number }) {
  const halo = useMemo(() => makeGlowTexture("rgba(255,240,200,0.55)", "rgba(255,240,200,0)"), []);
  return (
    <group position={position}>
      <mesh>
        <icosahedronGeometry args={[size, 2]} />
        <meshBasicMaterial color="#fff2c4" fog={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.5]}>
        <planeGeometry args={[size * 5, size * 5]} />
        <meshBasicMaterial map={halo} transparent depthWrite={false} fog={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function Decor() {
  return (
    <group>
      <Moon />
      {/* corner clusters (M19: the far corner pumpkins glow without casting light, to save a point light each) */}
      <Pumpkin position={[-12.8, 0, -8.6]} scale={1.3} rotationY={0.6} />
      <Pumpkin position={[-12, 0, -9.2]} scale={0.8} rotationY={0.2} />
      <Pumpkin position={[12.8, 0, -8.6]} scale={1.3} rotationY={-0.6} />
      <Pumpkin position={[12.1, 0, -9.3]} scale={0.7} rotationY={-0.2} />
      <Pumpkin position={[-12.9, 0, 8.7]} scale={1.1} rotationY={2.4} />
      <Pumpkin position={[12.9, 0, 8.7]} scale={1.1} rotationY={-2.4} />
      {/* welcome pumpkins at the front doors */}
      <Pumpkin position={[-2.6, 0, 9.3]} scale={0.9} rotationY={Math.PI - 0.3} lit />
      <Pumpkin position={[2.6, 0, 9.3]} scale={0.9} rotationY={Math.PI + 0.3} lit />
      {/* on the reception desk */}
      <Pumpkin position={[-2.4, 1.17, -8.3]} scale={0.5} rotationY={0.2} />
      <CandleCluster position={[2.4, 1.17, -8.3]} />
      <CandleCluster position={[-0.6, 1.17, -8.4]} />
      {/* candles at pillar bases */}
      {[-10, 10].flatMap((x) => [-6, 0, 6].map((z) => <CandleCluster key={`${x}${z}`} position={[x + (x < 0 ? 0.9 : -0.9), 0, z + 0.5]} />))}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Bat key={i} radius={5 + i * 1.3} height={5.5 + (i % 3) * 0.9} speed={0.35 + (i % 4) * 0.08} offset={i * 1.7} />
      ))}
      <Sparkles count={70} scale={[26, 5, 18]} position={[0, 2.8, 0]} size={2.2} speed={0.25} opacity={0.55} color="#c4b5fd" />
    </group>
  );
}

export function Lights() {
  return (
    <>
      <ambientLight intensity={1.15} color="#7a68a8" />
      <hemisphereLight args={["#6b5ba0", "#1a0f24", 1.3]} />
      <directionalLight position={[8, 14, -6]} intensity={1.05} color="#a9bcff" />
      <pointLight position={[0, 3, -7]} color="#ffb347" intensity={6} distance={10} decay={1.6} />
    </>
  );
}
