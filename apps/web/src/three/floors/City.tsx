import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/** Street level, far below the rooftop (the roof is y = 0). */
const GROUND = -36;
const RIVER = { minZ: -66, maxZ: -54 };
const HOTEL = { half: 18 };

/** Small deterministic RNG so every guest sees the same skyline. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function windowTexture(seed: number, cols: number, rows: number, lit: number): THREE.CanvasTexture {
  const rng = mulberry32(seed);
  const w = cols * 8;
  const h = rows * 8;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);
  const palette = ["#ffd58a", "#ffc46b", "#fff1c9", "#9ad0ff", "#ffb3d9"];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (rng() > lit) continue;
      ctx.fillStyle = palette[Math.floor(rng() * (rng() < 0.85 ? 3 : palette.length))] as string;
      ctx.globalAlpha = 0.55 + rng() * 0.45;
      ctx.fillRect(x * 8 + 2, y * 8 + 2, 4, 5);
    }
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

interface Building {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  style: number;
  tint: number;
}

function planCity(): Building[] {
  const rng = mulberry32(1031);
  const out: Building[] = [];
  const step = 9;
  for (let gx = -14; gx <= 14; gx++) {
    for (let gz = -14; gz <= 12; gz++) {
      const x = gx * step + (rng() - 0.5) * 2;
      const z = gz * step + (rng() - 0.5) * 2;
      const dist = Math.hypot(x, z);
      if (dist < HOTEL.half + 8 || dist > 128) continue;
      if (z > RIVER.minZ - 3 && z < RIVER.maxZ + 3) continue; // the river
      if (gx % 4 === 0 || gz % 4 === 0) continue; // avenues
      if (rng() < 0.12) continue; // little parks and plazas
      const tall = rng() < 0.12;
      out.push({
        x,
        z,
        w: 3.5 + rng() * 3.5,
        d: 3.5 + rng() * 3.5,
        // The hotel stays the tallest: every rooftop is below ours (y = 0 is our roof, GROUND = -36).
        h: tall ? 20 + rng() * 10 : 4 + rng() * 16 * (1 - Math.min(1, dist / 160)),
        style: Math.floor(rng() * 3),
        tint: rng(),
      });
    }
  }
  return out;
}

function Buildings() {
  const plan = useMemo(planCity, []);
  const textures = useMemo(() => [windowTexture(1, 6, 16, 0.42), windowTexture(2, 4, 10, 0.3), windowTexture(3, 8, 24, 0.55)], []);
  const groups = useMemo(() => [0, 1, 2].map((s) => plan.filter((b) => b.style === s)), [plan]);
  const refs = [useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null)];

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const color = new THREE.Color();
    groups.forEach((list, i) => {
      const mesh = refs[i]?.current;
      if (!mesh) return;
      list.forEach((b, j) => {
        m.compose(new THREE.Vector3(b.x, GROUND + b.h / 2, b.z), q, new THREE.Vector3(b.w, b.h, b.d));
        mesh.setMatrixAt(j, m);
        mesh.setColorAt(j, color.setHSL(0.72 + b.tint * 0.1, 0.25, 0.08 + b.tint * 0.06));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
    // refs are stable; groups only change with the (fixed) plan
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  return (
    <>
      {groups.map((list, i) => (
        <instancedMesh key={i} ref={refs[i]} args={[undefined, undefined, list.length]} frustumCulled={false}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveMap={textures[i]} emissiveIntensity={1.15} roughness={0.9} />
        </instancedMesh>
      ))}
    </>
  );
}

/** Car lights moving along the avenues: white one way, red the other. */
function Traffic() {
  const count = 90;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const cars = useMemo(() => {
    const rng = mulberry32(77);
    return Array.from({ length: count }, (_, i) => ({
      alongX: i % 2 === 0,
      lane: (Math.floor(rng() * 7) - 3) * 36 + (rng() < 0.5 ? -1.2 : 1.2),
      speed: (6 + rng() * 6) * (rng() < 0.5 ? -1 : 1),
      offset: rng() * 260,
    }));
  }, []);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    cars.forEach((c, i) => m.setColorAt(i, color.set(c.speed > 0 ? "#fff1c9" : "#ff3b3b")));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [cars, color]);

  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const t = clock.elapsedTime;
    cars.forEach((c, i) => {
      const s = (((c.offset + t * c.speed) % 260) + 260) % 260 - 130;
      if (c.alongX) tmp.position.set(s, GROUND + 0.4, c.lane);
      else tmp.position.set(c.lane, GROUND + 0.4, s);
      // Hide cars that would drive through the river or the hotel.
      const hidden = (!c.alongX && s > RIVER.minZ && s < RIVER.maxZ) || (Math.abs(tmp.position.x) < HOTEL.half && Math.abs(tmp.position.z) < HOTEL.half);
      tmp.scale.setScalar(hidden ? 0 : 1);
      tmp.rotation.y = c.alongX ? 0 : Math.PI / 2;
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[1.6, 0.35, 0.7]} />
      <meshBasicMaterial color="#ffffff" toneMapped={false} />
    </instancedMesh>
  );
}

function StreetLights() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const spots = useMemo(() => {
    const list: [number, number][] = [];
    for (let lane = -3; lane <= 3; lane++) {
      for (let s = -126; s <= 126; s += 6) {
        const a: [number, number] = [s, lane * 36 + 2.6];
        const b: [number, number] = [lane * 36 + 2.6, s];
        for (const [x, z] of [a, b]) {
          if (Math.abs(x) < HOTEL.half + 2 && Math.abs(z) < HOTEL.half + 2) continue;
          if (z > RIVER.minZ && z < RIVER.maxZ) continue;
          list.push([x, z]);
        }
      }
    }
    return list;
  }, []);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const tmp = new THREE.Object3D();
    spots.forEach(([x, z], i) => {
      tmp.position.set(x, GROUND + 1.2, z);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [spots]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, spots.length]} frustumCulled={false}>
      <sphereGeometry args={[0.25, 6, 4]} />
      <meshBasicMaterial color="#ffb347" toneMapped={false} />
    </instancedMesh>
  );
}

function River() {
  const shimmer = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (shimmer.current) shimmer.current.opacity = 0.35 + Math.sin(clock.elapsedTime * 1.3) * 0.08;
  });
  const z = (RIVER.minZ + RIVER.maxZ) / 2;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND + 0.05, z]}>
        <planeGeometry args={[300, RIVER.maxZ - RIVER.minZ]} />
        <meshStandardMaterial color="#0a1630" roughness={0.15} metalness={0.6} />
      </mesh>
      {/* the moon's reflection */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND + 0.08, z]}>
        <planeGeometry args={[4, RIVER.maxZ - RIVER.minZ - 1]} />
        <meshBasicMaterial ref={shimmer} color="#fff2c4" transparent opacity={0.35} toneMapped={false} depthWrite={false} />
      </mesh>
      {/* bridge with a row of lamps */}
      <mesh position={[24, GROUND + 2.2, z]}>
        <boxGeometry args={[5, 0.6, RIVER.maxZ - RIVER.minZ + 6]} />
        <meshStandardMaterial color="#2a2438" />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <group key={i}>
          {[-2.6, 2.6].map((dx) => (
            <mesh key={dx} position={[24 + dx, GROUND + 3.4, RIVER.minZ - 2 + i * 2]}>
              <sphereGeometry args={[0.3, 6, 4]} />
              <meshBasicMaterial color="#fff1c9" toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function ClockTower({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, GROUND, z]}>
      <mesh position={[0, 13, 0]}>
        <boxGeometry args={[6, 26, 6]} />
        <meshStandardMaterial color="#2a2438" flatShading />
      </mesh>
      <mesh position={[0, 29.5, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[5, 7, 4]} />
        <meshStandardMaterial color="#1a1626" flatShading />
      </mesh>
      <mesh position={[0, 21, 3.05]}>
        <circleGeometry args={[2.2, 24]} />
        <meshBasicMaterial color="#ffe9b0" toneMapped={false} />
      </mesh>
      <mesh position={[0, 21.4, 3.1]} rotation={[0, 0, 0.4]}>
        <boxGeometry args={[0.18, 1.6, 0.05]} />
        <meshBasicMaterial color="#1a1024" />
      </mesh>
      <mesh position={[0.5, 21, 3.1]} rotation={[0, 0, -1.2]}>
        <boxGeometry args={[0.18, 1.1, 0.05]} />
        <meshBasicMaterial color="#1a1024" />
      </mesh>
    </group>
  );
}

function Church({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, GROUND, z]}>
      <mesh position={[0, 8, 0]}>
        <boxGeometry args={[9, 16, 18]} />
        <meshStandardMaterial color="#2b2838" flatShading />
      </mesh>
      <mesh position={[0, 18, 0]} rotation={[0, 0, Math.PI / 4]} scale={[1, 1, 2.6]}>
        <boxGeometry args={[6.4, 6.4, 7]} />
        <meshStandardMaterial color="#1a1626" flatShading />
      </mesh>
      <mesh position={[0, 13, 9]}>
        <boxGeometry args={[4, 26, 4]} />
        <meshStandardMaterial color="#2b2838" flatShading />
      </mesh>
      <mesh position={[0, 31, 9]}>
        <coneGeometry args={[2.8, 10, 6]} />
        <meshStandardMaterial color="#1a1626" flatShading />
      </mesh>
      <mesh position={[0, 10, 9.1]} rotation={[0, 0, 0]}>
        <circleGeometry args={[2.4, 12]} />
        <meshBasicMaterial color="#b18cff" toneMapped={false} />
      </mesh>
    </group>
  );
}

function RadioTower({ x, z }: { x: number; z: number }) {
  const light = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (light.current) light.current.color.set(Math.sin(clock.elapsedTime * 3) > 0.6 ? "#ff2a2a" : "#3a0808");
  });
  return (
    <group position={[x, GROUND, z]}>
      <mesh position={[0, 30, 0]}>
        <boxGeometry args={[7, 60, 7]} />
        <meshStandardMaterial color="#231f30" flatShading />
      </mesh>
      <mesh position={[0, 70, 0]}>
        <cylinderGeometry args={[0.25, 0.6, 20, 4]} />
        <meshStandardMaterial color="#3a3650" />
      </mesh>
      <mesh position={[0, 80.5, 0]}>
        <sphereGeometry args={[0.8, 8, 6]} />
        <meshBasicMaterial ref={light} color="#ff2a2a" toneMapped={false} />
      </mesh>
    </group>
  );
}

/** The hotel itself: a tall façade under the roof, so the rooftop is the top of a tower. */
function HotelFacade() {
  const tex = useMemo(() => {
    const t = windowTexture(9, 10, 26, 0.5);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 1.4);
    return t;
  }, []);
  return (
    <group>
      <mesh position={[0, GROUND / 2 - 0.5, 0]}>
        <boxGeometry args={[33, -GROUND - 1, 25]} />
        <meshStandardMaterial color="#2a1f33" emissive="#ffffff" emissiveMap={tex} emissiveIntensity={0.9} roughness={0.9} />
      </mesh>
      {/* a neon "GHOSTEL" glow band near the top */}
      <mesh position={[0, -2.2, 12.6]}>
        <boxGeometry args={[20, 0.5, 0.2]} />
        <meshBasicMaterial color="#ff7a1a" toneMapped={false} />
      </mesh>
    </group>
  );
}

export function City() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND, 0]}>
        <planeGeometry args={[320, 320]} />
        <meshStandardMaterial color="#120f1c" roughness={1} />
      </mesh>
      {/* avenues */}
      {[-3, -2, -1, 0, 1, 2, 3].map((lane) => (
        <group key={lane}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND + 0.02, lane * 36]}>
            <planeGeometry args={[300, 5]} />
            <meshStandardMaterial color="#1d1a28" roughness={1} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[lane * 36, GROUND + 0.02, 0]}>
            <planeGeometry args={[5, 300]} />
            <meshStandardMaterial color="#1d1a28" roughness={1} />
          </mesh>
        </group>
      ))}
      <HotelFacade />
      <Buildings />
      <StreetLights />
      <Traffic />
      <River />
      <ClockTower x={-34} z={-40} />
      <Church x={38} z={-34} />
      <RadioTower x={-62} z={-92} />
      <Sparkles count={120} scale={[220, 14, 220]} position={[0, GROUND + 10, -20]} size={6} speed={0.15} opacity={0.6} color="#ffd58a" />
    </group>
  );
}
