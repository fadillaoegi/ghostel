import { CANDIES, CANDY_REACH, type CandyDef, type FloorNumber } from "@ghostel/shared";
import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import * as THREE from "three";

const COLORS: Record<CandyDef["kind"], string> = { wrapped: "#ff70a6", lollipop: "#8b5cf6", corn: "#ffb347" };

function Candy({ def, selfPos, onCollect }: { def: CandyDef; selfPos: RefObject<{ x: number; z: number }>; onCollect: (id: string) => void }) {
  const group = useRef<THREE.Group>(null);
  const lastAsk = useRef(-Infinity);
  const color = COLORS[def.kind];

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + def.x;
    if (group.current) {
      group.current.position.y = 0.7 + Math.sin(t * 2.2) * 0.12;
      group.current.rotation.y = t * 1.6;
    }
    const me = selfPos.current;
    if (!me) return;
    const now = performance.now();
    // Ask at most every 1.5 s; the server decides, using its own copy of our position.
    if (Math.hypot(me.x - def.x, me.z - def.z) < CANDY_REACH && now - lastAsk.current > 1500) {
      lastAsk.current = now;
      onCollect(def.id);
    }
  });

  return (
    <group position={[def.x, 0, def.z]}>
      <group ref={group}>
        {def.kind === "lollipop" ? (
          <>
            <mesh position={[0, 0.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.2, 0.2, 0.07, 12]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} />
            </mesh>
            <mesh position={[0, -0.12, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 0.45, 5]} />
              <meshStandardMaterial color="#f4f1de" />
            </mesh>
          </>
        ) : def.kind === "corn" ? (
          <mesh rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.16, 0.38, 6]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} flatShading />
          </mesh>
        ) : (
          <>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.13, 0.13, 0.3, 8]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} flatShading />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.23, 0, 0]} rotation={[0, 0, (s * -Math.PI) / 2]}>
                <coneGeometry args={[0.12, 0.16, 5]} />
                <meshStandardMaterial color="#f4f1de" emissive={color} emissiveIntensity={0.3} flatShading />
              </mesh>
            ))}
          </>
        )}
      </group>
      {/* glow on the floor so candies are findable */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.5, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.28} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function Candies({
  floor,
  found,
  selfPos,
  onCollect,
}: {
  floor: FloorNumber;
  found: readonly string[];
  selfPos: RefObject<{ x: number; z: number }>;
  onCollect: (id: string) => void;
}) {
  return (
    <>
      {CANDIES.filter((c) => c.floor === floor && !found.includes(c.id)).map((c) => (
        <Candy key={c.id} def={c} selfPos={selfPos} onCollect={onCollect} />
      ))}
    </>
  );
}
