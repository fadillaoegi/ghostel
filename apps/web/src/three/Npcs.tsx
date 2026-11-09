import { NPC_TALK_COOLDOWN_MS, NPC_TALK_RADIUS, RECEPTIONIST_ID, type NpcDef } from "@ghostel/shared";
import { WALK_SPEED } from "@ghostel/shared";
import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import * as THREE from "three";
import { Avatar, type Motion } from "./Avatar";
import { useTagAnchor, type TagRegistry } from "./nametags";

export const npcTagId = (id: string) => `npc:${id}`;

function lerpAngle(from: number, to: number, t: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + d * t;
}

function NpcGhost({
  def,
  tags,
  selfPos,
  onTalk,
}: {
  def: NpcDef;
  tags: TagRegistry;
  selfPos: RefObject<{ x: number; z: number }>;
  onTalk: (tagId: string, text: string) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const near = useRef(false);
  const lastTalk = useRef(-Infinity);
  const line = useRef(Math.floor(Math.random() * def.lines.length));
  useTagAnchor(tags, npcTagId(def.id), group);
  const baseY = def.id === RECEPTIONIST_ID ? 0.95 : 0.45;
  const motion = useRef<Motion>({ speed: 0 });
  const last = useRef<{ x: number; z: number } | null>(null);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const t = Date.now() / 1000;
    const pose = def.pose(t);
    if (last.current && dt > 0) {
      const speed = Math.hypot(pose.x - last.current.x, pose.z - last.current.z) / dt / WALK_SPEED;
      motion.current.speed += (Math.min(1, speed * 1.6) - motion.current.speed) * (1 - Math.exp(-dt * 6));
    }
    last.current = { x: pose.x, z: pose.z };
    const g = group.current;
    if (g) {
      g.position.x = pose.x;
      g.position.z = pose.z;
      g.rotation.y = lerpAngle(g.rotation.y, pose.ry, 1 - Math.exp(-dt * 4));
    }
    if (body.current) {
      body.current.position.y = baseY + Math.sin(t * 1.7 + def.id.length) * 0.12;
      body.current.rotation.z = Math.sin(t * 1.1 + def.id.length) * 0.08;
    }
    const me = selfPos.current;
    if (!me) return;
    const isNear = Math.hypot(pose.x - me.x, pose.z - me.z) < NPC_TALK_RADIUS;
    const now = performance.now();
    if (isNear && !near.current && now - lastTalk.current > NPC_TALK_COOLDOWN_MS) {
      lastTalk.current = now;
      onTalk(npcTagId(def.id), def.lines[line.current % def.lines.length] as string);
      line.current += 1;
    }
    near.current = isNear;
  });

  if (def.look) {
    return (
      <group ref={group} scale={def.scale}>
        <Avatar look={def.look} motion={motion} />
      </group>
    );
  }

  return (
    <group ref={group} scale={def.scale}>
      <group ref={body}>
        <mesh position={[0, 0.45, 0]}>
          <coneGeometry args={[0.42, 0.95, 9, 1, true]} />
          <meshStandardMaterial
            color="#f4f1de"
            emissive={def.tint}
            emissiveIntensity={0.55}
            transparent
            opacity={0.82}
            side={THREE.DoubleSide}
            flatShading
          />
        </mesh>
        <mesh position={[0, 0.92, 0]}>
          <icosahedronGeometry args={[0.3, 1]} />
          <meshStandardMaterial color="#f4f1de" emissive={def.tint} emissiveIntensity={0.55} transparent opacity={0.88} flatShading />
        </mesh>
        {[-0.1, 0.1].map((x) => (
          <mesh key={x} position={[x, 0.95, 0.26]}>
            <sphereGeometry args={[0.05, 6, 4]} />
            <meshBasicMaterial color="#1a1024" />
          </mesh>
        ))}
        <mesh position={[0, 0.83, 0.28]} scale={[1, 1.4, 0.6]}>
          <sphereGeometry args={[0.035, 6, 4]} />
          <meshBasicMaterial color="#1a1024" />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.36, 0.55, 0.05]} rotation={[0, 0, side * -0.9]}>
            <coneGeometry args={[0.08, 0.32, 5]} />
            <meshStandardMaterial color="#f4f1de" emissive={def.tint} emissiveIntensity={0.5} transparent opacity={0.8} flatShading />
          </mesh>
        ))}
        {def.id === RECEPTIONIST_ID && (
          <mesh position={[0, 1.24, 0]}>
            <cylinderGeometry args={[0.16, 0.18, 0.2, 8]} />
            <meshStandardMaterial color="#5c0f1f" />
          </mesh>
        )}
      </group>
    </group>
  );
}

export function Npcs({
  defs,
  tags,
  selfPos,
  onTalk,
}: {
  defs: readonly NpcDef[];
  tags: TagRegistry;
  selfPos: RefObject<{ x: number; z: number }>;
  onTalk: (tagId: string, text: string) => void;
}) {
  return (
    <>
      {defs.map((def) => (
        <NpcGhost key={def.id} def={def} tags={tags} selfPos={selfPos} onTalk={onTalk} />
      ))}
    </>
  );
}
