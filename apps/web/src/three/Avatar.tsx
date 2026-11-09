import { COLORS, type Look } from "@ghostel/shared";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";

/** Mutable motion info written by whoever moves the avatar (0 = idle, 1 = full walk). */
export interface Motion {
  speed: number;
  /** Sitting on a chair: hips on the seat, legs forward, no walk cycle. */
  sitting?: boolean;
}

interface AvatarProps {
  look: Look;
  motion?: RefObject<Motion>;
}

const INK = "#1a1024";
const GLOW = "#ffd36b";

function Mat({ color, emissive, intensity = 0, opacity = 1 }: { color: string; emissive?: string; intensity?: number; opacity?: number }) {
  return (
    <meshStandardMaterial
      color={color}
      flatShading
      roughness={0.85}
      metalness={0}
      emissive={emissive ?? "#000000"}
      emissiveIntensity={intensity}
      transparent={opacity < 1}
      opacity={opacity}
    />
  );
}

function Eyes({ y = 0, z = 0.27, spread = 0.11, color = INK, glow = false }: { y?: number; z?: number; spread?: number; color?: string; glow?: boolean }) {
  return (
    <group position={[0, y, z]}>
      {[-spread, spread].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <icosahedronGeometry args={[0.05, 0]} />
          <Mat color={color} emissive={glow ? color : undefined} intensity={glow ? 2 : 0} />
        </mesh>
      ))}
    </group>
  );
}


const SKIN: Partial<Record<Look["head"], string>> = {
  skull: "#efe6cf",
  vampire: "#ece6f2",
  werewolf: "#5a4637",
  frankenstein: "#6aa84f",
  zombie: "#8fa37a",
  alien: "#9fe39a",
};

function MonsterHead({ head }: { head: Look["head"] }) {
  switch (head) {
    case "vampire":
      return (
        <group>
          <mesh scale={[0.95, 1.08, 0.95]}>
            <icosahedronGeometry args={[0.29, 1]} />
            <Mat color="#ece6f2" />
          </mesh>
          <mesh position={[0, 0.08, -0.02]} scale={[1.04, 0.85, 1.04]}>
            <sphereGeometry args={[0.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Mat color="#15111c" />
          </mesh>
          <mesh position={[0, 0.16, 0.25]} rotation={[0.5, 0, Math.PI]}>
            <coneGeometry args={[0.07, 0.14, 3]} />
            <Mat color="#15111c" />
          </mesh>
          <Eyes y={0.02} z={0.26} spread={0.1} color="#ff3b3b" glow />
          {[-0.05, 0.05].map((x) => (
            <mesh key={x} position={[x, -0.13, 0.25]} rotation={[0, 0, Math.PI]}>
              <coneGeometry args={[0.018, 0.07, 4]} />
              <Mat color="#ffffff" />
            </mesh>
          ))}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.28, 0.03, 0]} rotation={[0, 0, -side * 0.6]}>
              <coneGeometry args={[0.05, 0.14, 3]} />
              <Mat color="#ece6f2" />
            </mesh>
          ))}
        </group>
      );
    case "werewolf":
      return (
        <group>
          <mesh>
            <icosahedronGeometry args={[0.3, 0]} />
            <Mat color="#5a4637" />
          </mesh>
          <mesh position={[0, -0.06, 0.26]}>
            <boxGeometry args={[0.2, 0.16, 0.22]} />
            <Mat color="#7a604a" />
          </mesh>
          <mesh position={[0, -0.01, 0.38]}>
            <sphereGeometry args={[0.04, 6, 4]} />
            <Mat color="#120a1a" />
          </mesh>
          {[-0.06, 0.06].map((x) => (
            <mesh key={x} position={[x, -0.15, 0.34]} rotation={[0, 0, Math.PI]}>
              <coneGeometry args={[0.018, 0.05, 4]} />
              <Mat color="#ffffff" />
            </mesh>
          ))}
          {[-0.16, 0.16].map((x) => (
            <mesh key={x} position={[x, 0.28, -0.02]} rotation={[0, 0, -x * 1.4]}>
              <coneGeometry args={[0.08, 0.24, 4]} />
              <Mat color="#4a3a2d" />
            </mesh>
          ))}
          <Eyes y={0.08} z={0.24} spread={0.11} color="#ffd23a" glow />
        </group>
      );
    case "frankenstein":
      return (
        <group>
          <mesh>
            <boxGeometry args={[0.5, 0.56, 0.48]} />
            <Mat color="#6aa84f" />
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[0.54, 0.12, 0.52]} />
            <Mat color="#15111c" />
          </mesh>
          <mesh position={[0, 0.22, 0.25]}>
            <boxGeometry args={[0.54, 0.06, 0.04]} />
            <Mat color="#15111c" />
          </mesh>
          {[-0.08, -0.03, 0.02, 0.07].map((x) => (
            <mesh key={x} position={[x + 0.02, 0.13, 0.245]}>
              <boxGeometry args={[0.01, 0.06, 0.01]} />
              <Mat color="#1a1024" />
            </mesh>
          ))}
          <mesh position={[0.02, 0.13, 0.245]}>
            <boxGeometry args={[0.2, 0.01, 0.01]} />
            <Mat color="#1a1024" />
          </mesh>
          <Eyes y={0.02} z={0.25} spread={0.11} color="#ffe680" glow />
          <mesh position={[0, -0.14, 0.245]}>
            <boxGeometry args={[0.18, 0.025, 0.01]} />
            <Mat color="#1a1024" />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.28, -0.24, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.035, 0.035, 0.14, 6]} />
              <meshStandardMaterial color="#9aa0aa" metalness={0.9} roughness={0.3} />
            </mesh>
          ))}
        </group>
      );
    case "zombie":
      return (
        <group>
          <mesh scale={[1, 1.05, 0.95]} rotation={[0, 0, 0.12]}>
            <icosahedronGeometry args={[0.29, 0]} />
            <Mat color="#8fa37a" />
          </mesh>
          <mesh position={[-0.1, 0.04, 0.24]}>
            <sphereGeometry args={[0.065, 8, 6]} />
            <Mat color="#f4f1de" />
          </mesh>
          <mesh position={[-0.1, 0.04, 0.3]}>
            <sphereGeometry args={[0.025, 6, 4]} />
            <Mat color="#120a1a" />
          </mesh>
          <mesh position={[0.11, 0.05, 0.25]}>
            <sphereGeometry args={[0.03, 6, 4]} />
            <Mat color="#c81d25" emissive="#c81d25" intensity={0.8} />
          </mesh>
          <mesh position={[0.02, -0.12, 0.25]} rotation={[0, 0, 0.15]}>
            <boxGeometry args={[0.17, 0.04, 0.02]} />
            <Mat color="#2a1a10" />
          </mesh>
          {[-0.04, 0.02, 0.08].map((x) => (
            <mesh key={x} position={[x + 0.06, 0.18, 0.22]} rotation={[0, 0, 0.6]}>
              <boxGeometry args={[0.01, 0.07, 0.01]} />
              <Mat color="#3b2416" />
            </mesh>
          ))}
          <mesh position={[0.05, 0.25, 0]} scale={[1, 0.4, 1]}>
            <icosahedronGeometry args={[0.18, 0]} />
            <Mat color="#3b2a1d" />
          </mesh>
        </group>
      );
    case "alien":
      return (
        <group position={[0, 0.04, 0]}>
          <mesh scale={[1.2, 1.12, 1]}>
            <sphereGeometry args={[0.28, 10, 7]} />
            <Mat color="#9fe39a" />
          </mesh>
          <mesh position={[0, -0.25, 0.04]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.16, 0.2, 7]} />
            <Mat color="#9fe39a" />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.12, -0.01, 0.24]} rotation={[0, 0, side * 0.45]} scale={[1, 0.55, 0.4]}>
              <sphereGeometry args={[0.1, 10, 6]} />
              <meshStandardMaterial color="#05030a" metalness={0.6} roughness={0.15} />
            </mesh>
          ))}
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 0.12, 0.3, 0]} rotation={[0, 0, -side * 0.35]}>
              <mesh position={[0, 0.1, 0]}>
                <cylinderGeometry args={[0.012, 0.012, 0.2, 4]} />
                <Mat color="#6fbf6a" />
              </mesh>
              <mesh position={[0, 0.22, 0]}>
                <sphereGeometry args={[0.04, 8, 6]} />
                <Mat color="#c6ff4d" emissive="#c6ff4d" intensity={1.5} />
              </mesh>
            </group>
          ))}
        </group>
      );
    default:
      return null;
  }
}

function Head({ look }: { look: Look }) {
  const body = COLORS[look.body];
  switch (look.head) {
    case "pumpkin":
      return (
        <group>
          <mesh scale={[1.15, 0.9, 1.05]}>
            <sphereGeometry args={[0.3, 8, 5]} />
            <Mat color="#ff7a1a" />
          </mesh>
          <mesh position={[0, 0.3, 0]} rotation={[0, 0, 0.2]}>
            <cylinderGeometry args={[0.03, 0.05, 0.14, 5]} />
            <Mat color="#3f7d20" />
          </mesh>
          {/* carved face */}
          {[-0.11, 0.11].map((x) => (
            <mesh key={x} position={[x, 0.05, 0.29]} rotation={[0, 0, Math.PI]}>
              <coneGeometry args={[0.055, 0.08, 3]} />
              <Mat color={GLOW} emissive={GLOW} intensity={2.5} />
            </mesh>
          ))}
          <mesh position={[0, -0.09, 0.285]} scale={[1, 0.35, 0.3]}>
            <sphereGeometry args={[0.13, 6, 3, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
            <Mat color={GLOW} emissive={GLOW} intensity={2.5} />
          </mesh>
        </group>
      );
    case "skull":
      return (
        <group>
          <mesh scale={[1, 1.05, 1]}>
            <dodecahedronGeometry args={[0.29, 0]} />
            <Mat color="#efe6cf" />
          </mesh>
          <mesh position={[0, -0.22, 0.06]}>
            <boxGeometry args={[0.28, 0.1, 0.24]} />
            <Mat color="#e2d6b8" />
          </mesh>
          <Eyes y={0.02} z={0.24} spread={0.1} color="#7cf7ff" glow />
          <mesh position={[0, -0.08, 0.27]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.035, 0.06, 3]} />
            <Mat color={INK} />
          </mesh>
        </group>
      );
    case "cat":
      return (
        <group>
          <mesh>
            <icosahedronGeometry args={[0.29, 1]} />
            <Mat color={body} />
          </mesh>
          {[-0.15, 0.15].map((x) => (
            <mesh key={x} position={[x, 0.26, 0]} rotation={[0, 0, -x * 1.6]}>
              <coneGeometry args={[0.08, 0.18, 4]} />
              <Mat color={body} />
            </mesh>
          ))}
          <Eyes y={0.03} z={0.25} spread={0.1} color="#c6ff4d" glow />
          <mesh position={[0, -0.05, 0.28]}>
            <coneGeometry args={[0.03, 0.04, 3]} />
            <Mat color="#ff70a6" />
          </mesh>
        </group>
      );
    case "vampire":
    case "werewolf":
    case "frankenstein":
    case "zombie":
    case "alien":
      return <MonsterHead head={look.head} />;
    default:
      return (
        <group>
          <mesh>
            <icosahedronGeometry args={[0.29, 1]} />
            <Mat color={body} />
          </mesh>
          <Eyes y={0.03} z={0.26} />
        </group>
      );
  }
}

function Hat({ look }: { look: Look }) {
  const accent = COLORS[look.accent];
  switch (look.hat) {
    case "crown":
      return (
        <group position={[0, 0.27, 0]}>
          <mesh>
            <cylinderGeometry args={[0.24, 0.22, 0.14, 8, 1, true]} />
            <meshStandardMaterial color="#ffcf3a" emissive="#ff9a00" emissiveIntensity={0.45} metalness={0.8} roughness={0.25} side={THREE.DoubleSide} flatShading />
          </mesh>
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.23, 0.12, Math.sin(a) * 0.23]}>
                <coneGeometry args={[0.045, 0.12, 4]} />
                <meshStandardMaterial color="#ffcf3a" emissive="#ff9a00" emissiveIntensity={0.45} metalness={0.8} roughness={0.25} flatShading />
              </mesh>
            );
          })}
          <mesh position={[0, 0.02, 0.23]}>
            <octahedronGeometry args={[0.045, 0]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.2} />
          </mesh>
        </group>
      );
    case "witch":
      return (
        <group position={[0, 0.24, 0]} rotation={[-0.12, 0, 0.08]}>
          <mesh>
            <cylinderGeometry args={[0.46, 0.46, 0.03, 10]} />
            <Mat color="#231537" />
          </mesh>
          <mesh position={[0, 0.3, 0]} rotation={[-0.2, 0, 0]}>
            <coneGeometry args={[0.26, 0.62, 7]} />
            <Mat color="#231537" />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.255, 0.27, 0.07, 7]} />
            <Mat color={accent} />
          </mesh>
        </group>
      );
    case "top":
      return (
        <group position={[0, 0.25, 0]} rotation={[0, 0, -0.08]}>
          <mesh>
            <cylinderGeometry args={[0.36, 0.36, 0.03, 10]} />
            <Mat color="#15111c" />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.21, 0.2, 0.4, 8]} />
            <Mat color="#15111c" />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.205, 0.205, 0.07, 8]} />
            <Mat color={accent} />
          </mesh>
        </group>
      );
    case "pirate":
      return (
        <group position={[0, 0.25, 0]} rotation={[-0.08, 0, 0]}>
          <mesh rotation={[0, Math.PI / 6, 0]}>
            <cylinderGeometry args={[0.46, 0.44, 0.07, 3]} />
            <Mat color="#1a1024" />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.22, 0.27, 0.22, 8]} />
            <Mat color="#1a1024" />
          </mesh>
          <mesh position={[0, 0.06, 0.25]}>
            <cylinderGeometry args={[0.27, 0.27, 0.02, 8, 1, false, -0.6, 1.2]} />
            <Mat color={accent} />
          </mesh>
          <mesh position={[0, 0.13, 0.25]}>
            <sphereGeometry args={[0.045, 8, 6]} />
            <Mat color="#f4f1de" />
          </mesh>
        </group>
      );
    case "batears":
      return (
        <group position={[0, 0.2, 0]}>
          <mesh rotation={[Math.PI / 2 - 0.2, 0, 0]}>
            <torusGeometry args={[0.27, 0.02, 4, 14, Math.PI]} />
            <Mat color="#1a1024" />
          </mesh>
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 0.17, 0.14, 0]} rotation={[0, 0, -side * 0.35]}>
              <mesh scale={[1, 1, 0.3]}>
                <coneGeometry args={[0.11, 0.3, 4]} />
                <Mat color="#1a1024" />
              </mesh>
              <mesh position={[0, -0.02, 0.025]} scale={[0.6, 0.7, 0.2]}>
                <coneGeometry args={[0.11, 0.3, 4]} />
                <Mat color={accent} />
              </mesh>
            </group>
          ))}
        </group>
      );
    case "horns":
      return (
        <group position={[0, 0.18, 0]}>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.17, 0.1, 0]} rotation={[0, 0, -side * 0.5]}>
              <coneGeometry args={[0.06, 0.24, 5]} />
              <Mat color={accent} emissive={accent} intensity={0.35} />
            </mesh>
          ))}
        </group>
      );
    default:
      return null;
  }
}

function BatWings({ color }: { color: string }) {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const wing = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.62, 0.32);
    shape.lineTo(0.56, 0.04);
    shape.lineTo(0.44, 0.12);
    shape.lineTo(0.34, -0.08);
    shape.lineTo(0.22, 0.02);
    shape.lineTo(0.1, -0.16);
    shape.lineTo(0, -0.1);
    return new THREE.ShapeGeometry(shape);
  }, []);
  useFrame(({ clock }) => {
    const flap = 0.35 + Math.sin(clock.elapsedTime * 3) * 0.18;
    if (left.current) left.current.rotation.y = flap;
    if (right.current) right.current.rotation.y = -flap;
  });
  return (
    <group position={[0, 0.88, -0.24]}>
      <group ref={right}>
        <mesh geometry={wing}>
          <meshStandardMaterial color="#2a1f33" emissive={color} emissiveIntensity={0.15} side={THREE.DoubleSide} flatShading />
        </mesh>
      </group>
      <group ref={left} scale={[-1, 1, 1]}>
        <mesh geometry={wing}>
          <meshStandardMaterial color="#2a1f33" emissive={color} emissiveIntensity={0.15} side={THREE.DoubleSide} flatShading />
        </mesh>
      </group>
    </group>
  );
}

function Costume({ look }: { look: Look }) {
  const accent = COLORS[look.accent];
  switch (look.costume) {
    case "cape":
      return (
        <group position={[0, 0.98, -0.2]} rotation={[0.18, 0, 0]}>
          <mesh position={[0, -0.38, 0]} rotation={[0, Math.PI, 0]}>
            <cylinderGeometry args={[0.3, 0.55, 0.8, 8, 1, true, -Math.PI / 2.2, Math.PI / 1.1]} />
            <meshStandardMaterial color={accent} flatShading side={THREE.DoubleSide} roughness={0.7} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.2, 0.04, 0.14]} rotation={[0.4, 0, side * 0.5]}>
              <coneGeometry args={[0.1, 0.22, 3]} />
              <Mat color={accent} />
            </mesh>
          ))}
        </group>
      );
    case "sheet":
      return (
        <mesh position={[0, 0.58, 0]}>
          <cylinderGeometry args={[0.33, 0.5, 0.86, 9, 1, true]} />
          <meshStandardMaterial color="#f4f1de" flatShading side={THREE.DoubleSide} transparent opacity={0.88} emissive="#9ad0ff" emissiveIntensity={0.15} />
        </mesh>
      );
    case "batwings":
      return <BatWings color={accent} />;
    case "skeleton":
      return (
        <group position={[0, 0, 0.29]}>
          <mesh position={[0, 0.68, 0.02]}>
            <boxGeometry args={[0.05, 0.42, 0.02]} />
            <Mat color="#efe6cf" />
          </mesh>
          {[0.85, 0.76, 0.67, 0.58].map((y, i) => (
            <mesh key={y} position={[0, y, 0.015]}>
              <boxGeometry args={[0.36 - i * 0.03, 0.035, 0.02]} />
              <Mat color="#efe6cf" />
            </mesh>
          ))}
          <mesh position={[0, 0.44, 0.02]} scale={[1, 0.45, 0.2]}>
            <sphereGeometry args={[0.16, 8, 5]} />
            <Mat color="#efe6cf" />
          </mesh>
        </group>
      );
    case "wizard":
      return (
        <group>
          <mesh position={[0, 0.48, 0]}>
            <cylinderGeometry args={[0.3, 0.5, 0.96, 9]} />
            <Mat color={accent} />
          </mesh>
          <mesh position={[0, 0.96, 0]}>
            <cylinderGeometry args={[0.36, 0.3, 0.1, 9]} />
            <Mat color={accent} />
          </mesh>
          {[
            [0.2, 0.35, 0.36],
            [-0.24, 0.6, 0.3],
            [0.05, 0.75, 0.31],
            [-0.08, 0.22, 0.45],
          ].map(([x, y, z], i) => (
            <mesh key={i} position={[x as number, y as number, z as number]}>
              <octahedronGeometry args={[0.04, 0]} />
              <Mat color="#ffe680" emissive="#ffcf3a" intensity={1.4} />
            </mesh>
          ))}
        </group>
      );
    case "tattered":
      return (
        <group>
          <mesh position={[0, 0.66, 0]}>
            <cylinderGeometry args={[0.285, 0.375, 0.5, 7]} />
            <Mat color="#7d6b55" />
          </mesh>
          {Array.from({ length: 9 }, (_, i) => {
            const a = (i / 9) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.sin(a) * 0.36, 0.36 - (i % 3) * 0.03, Math.cos(a) * 0.36]} rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.06, 0.14 + (i % 2) * 0.06, 3]} />
                <Mat color="#6b5a46" />
              </mesh>
            );
          })}
          <mesh position={[0.12, 0.72, 0.3]} rotation={[0, 0, 0.3]}>
            <boxGeometry args={[0.1, 0.1, 0.02]} />
            <Mat color="#4b3f5c" />
          </mesh>
        </group>
      );
    case "fur":
      return (
        <group>
          <mesh position={[0, 0.95, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.28, 0.08, 5, 10]} />
            <Mat color="#5a4637" />
          </mesh>
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.sin(a) * 0.33, 0.6 + (i % 2) * 0.12, Math.cos(a) * 0.33]} rotation={[0, a, 0.4]}>
                <coneGeometry args={[0.05, 0.16, 3]} />
                <Mat color="#4a3a2d" />
              </mesh>
            );
          })}
        </group>
      );
    case "mummy":
      return (
        <group>
          {[0.3, 0.48, 0.66, 0.84].map((y, i) => (
            <mesh key={y} position={[0, y, 0]} rotation={[0.12 * (i % 2 ? 1 : -1), 0, 0.15 * (i % 2 ? -1 : 1)]}>
              <torusGeometry args={[0.36 - i * 0.025, 0.045, 3, 9]} />
              <Mat color="#e9dcc0" />
            </mesh>
          ))}
        </group>
      );
    default:
      return null;
  }
}

function Arm({ side, sleeve, hand }: { side: number; sleeve: string; hand: string }) {
  return (
    <>
      <mesh position={[0, -0.2, 0]} rotation={[0, 0, side * 0.15]}>
        <boxGeometry args={[0.11, 0.42, 0.12]} />
        <Mat color={sleeve} />
      </mesh>
      <mesh position={[side * 0.03, -0.43, 0]}>
        <icosahedronGeometry args={[0.07, 0]} />
        <Mat color={hand} />
      </mesh>
    </>
  );
}

/** Low-poly guest built from primitives. Faces +z. Feet at y = 0. */
export function Avatar({ look, motion }: AvatarProps) {
  const root = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Mesh>(null);
  const rightLeg = useRef<THREE.Mesh>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const phase = useRef(Math.random() * 10);
  const body = COLORS[look.body];
  const accent = COLORS[look.accent];
  const floats = look.costume === "sheet";
  const hideLegs = floats || look.costume === "wizard";
  const hand = SKIN[look.head] ?? accent;

  const shadow = useMemo(() => new THREE.CircleGeometry(0.42, 12), []);

  useFrame((_, dt) => {
    const sitting = motion?.current?.sitting === true;
    const speed = sitting ? 0 : (motion?.current?.speed ?? 0);
    phase.current += dt * (2 + speed * 9);
    const swing = Math.sin(phase.current) * 0.7 * speed;
    const legs = sitting ? -1.4 : 0;
    if (leftLeg.current) leftLeg.current.rotation.x = legs + swing;
    if (rightLeg.current) rightLeg.current.rotation.x = legs - swing;
    if (leftArm.current) leftArm.current.rotation.x = sitting ? -0.5 : -swing * 0.8;
    if (rightArm.current) rightArm.current.rotation.x = sitting ? -0.5 : swing * 0.8;
    if (root.current) {
      const bob = floats ? 0.12 + Math.sin(phase.current * 0.6) * 0.06 : Math.abs(Math.sin(phase.current)) * 0.06 * speed;
      root.current.position.y = sitting && !floats ? 0.2 : bob;
    }
  });

  return (
    <group>
      <mesh geometry={shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <meshBasicMaterial color="#000000" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <group ref={root}>
        {/* legs */}
        {!hideLegs && (
          <>
            <mesh ref={leftLeg} position={[-0.13, 0.22, 0]}>
              <boxGeometry args={[0.13, 0.36, 0.14]} />
              <Mat color={INK} />
            </mesh>
            <mesh ref={rightLeg} position={[0.13, 0.22, 0]}>
              <boxGeometry args={[0.13, 0.36, 0.14]} />
              <Mat color={INK} />
            </mesh>
          </>
        )}
        {/* torso */}
        <mesh position={[0, 0.66, 0]}>
          <cylinderGeometry args={[0.27, 0.36, 0.62, 7]} />
          <Mat color={body} />
        </mesh>
        {/* belt / collar accent */}
        <mesh position={[0, 0.42, 0]}>
          <cylinderGeometry args={[0.345, 0.36, 0.08, 7]} />
          <Mat color={accent} />
        </mesh>
        {/* arms */}
        <group ref={leftArm} position={[-0.36, 0.9, 0]}>
          <Arm side={-1} sleeve={body} hand={hand} />
        </group>
        <group ref={rightArm} position={[0.36, 0.9, 0]}>
          <Arm side={1} sleeve={body} hand={hand} />
        </group>
        <Costume look={look} />
        <group position={[0, 1.27, 0]}>
          <Head look={look} />
          <Hat look={look} />
        </group>
      </group>
    </group>
  );
}
