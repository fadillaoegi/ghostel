import {
  CLIENT_MOVE_HZ,
  ELEVATORS,
  FLOOR_NPCS,
  FLOOR_TABLES,
  FLOOR_TALKERS,
  LOBBY_NPCS,
  RECEPTIONIST_ID,
  WALK_SPEED,
  constrainToWorld,
  floorOfPlace,
  greeting,
  layoutForPlace,
  promptZones,
  roomHost,
  sceneKeyFor,
  type Layout,
  type Look,
  type Place,
  type PromptKind,
  type PromptZone,
  type Talker,
  type DoorInfo,
  type SnackId,
  type SeatDef,
  findSeat,
} from "@ghostel/shared";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { readMoveVector } from "../input/controls";
import type { Bubble, PlayerView, PresenceClient } from "../net/presence";
import type { VoiceMark } from "../ui/MeetingView";
import { Avatar, type Motion } from "./Avatar";
import { Decor, Lights } from "./Decor";
import { LobbyHall } from "./LobbyHall";
import { RoomInterior } from "./RoomInterior";
import { TagProjector, TagRegistry, useTagAnchor } from "./nametags";
import { Npcs, npcTagId } from "./Npcs";
import { Candies } from "./Candies";
import { Elevator } from "./Elevator";
import { Gallery } from "./floors/Gallery";
import { Greenhouse } from "./floors/Greenhouse";
import { Rooftop } from "./floors/Rooftop";
import { Canteen } from "./floors/Canteen";
import { Snack } from "./Snack";
import { TABLE_PALETTES, Tables, type TablePalette } from "./Tables";

const FLOOR_PALETTE: Record<1 | 2 | 3 | 5, TablePalette> = {
  1: TABLE_PALETTES.lobby,
  2: TABLE_PALETTES.gallery,
  3: TABLE_PALETTES.greenhouse,
  5: TABLE_PALETTES.rooftop,
};
import { RoomDoors } from "./RoomDoors";

function lerpAngle(from: number, to: number, t: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + d * t;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const SELF_TAG = "self";

/** What the guest is standing at: a door (with its code), the elevator or the mirror. */
export interface ScenePrompt {
  kind: PromptKind;
  code?: string;
}


function LocalPlayer({
  client,
  look,
  tags,
  layout,
  zones,
  onPrompt,
  selfPos,
  snack,
  seat,
  onStand,
}: {
  client: PresenceClient;
  look: Look;
  /** Diner snack in hand (server state). */
  snack: SnackId | undefined;
  /** The chair we sit on (server state); walking input stands us up. */
  seat: SeatDef | null;
  onStand: () => void;
  tags: TagRegistry;
  layout: Layout;
  /** Spots that show a prompt (room doors, elevator, mirror). */
  zones: readonly PromptZone[];
  onPrompt: (prompt: ScenePrompt | null) => void;
  /** Written every frame so NPCs can tell when we walk up to them. */
  selfPos: RefObject<{ x: number; z: number }>;
}) {
  const group = useRef<THREE.Group>(null);
  useTagAnchor(tags, SELF_TAG, group);
  const motion = useRef<Motion>({ speed: 0 });
  // Start where the server put us (welcome already arrived when this scene mounts). Reading it during
  // render matters: a frame can run before effects, and a move sent from a guessed spawn point would
  // pull the server-side position away from the elevator.
  const pos = useRef<{ x: number; z: number }>(null as unknown as { x: number; z: number });
  if (pos.current === null) {
    const snapshot = client.getSnapshot();
    const self = snapshot.players.find((p) => p.id === snapshot.selfId);
    pos.current = self ? { x: self.target.x, z: self.target.z } : layout.spawn();
  }
  const placed = useRef(false);
  const prompt = useRef<PromptZone | null>(null);
  const ry = useRef(Math.PI);
  const sent = useRef({ x: Number.NaN, z: Number.NaN, ry: Number.NaN, at: 0 });
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const lookAt = useRef(new THREE.Vector3());
  const scratch = useRef(new THREE.Vector3());

  useEffect(() => {
    const snapshot = client.getSnapshot();
    const self = snapshot.players.find((p) => p.id === snapshot.selfId);
    if (self) pos.current = { x: self.target.x, z: self.target.z };
    placed.current = true;
    client.onSelfTeleport = (x, z, r) => {
      pos.current = { x, z };
      if (r !== null) ry.current = r;
    };
    return () => {
      client.onSelfTeleport = null;
    };
  }, [client]);

  const standAsked = useRef(0);
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const dir = readMoveVector();
    const mag = Math.min(1, Math.hypot(dir.x, dir.z));
    motion.current.sitting = seat !== null;
    if (seat) {
      // Seated: stay on the chair, facing the table. Walking input asks to stand up (at most twice a second).
      pos.current = { x: seat.x, z: seat.z };
      ry.current = seat.ry;
      if (mag > 0.5 && state.clock.elapsedTime - standAsked.current > 0.5) {
        standAsked.current = state.clock.elapsedTime;
        onStand();
      }
    } else if (mag > 0.05) {
      pos.current = constrainToWorld(
        { x: pos.current.x + dir.x * WALK_SPEED * dt, z: pos.current.z + dir.z * WALK_SPEED * dt },
        layout,
      );
      ry.current = lerpAngle(ry.current, Math.atan2(dir.x, dir.z), 1 - Math.exp(-dt * 14));
    }
    motion.current.speed += (mag - motion.current.speed) * (1 - Math.exp(-dt * 10));

    let zone: PromptZone | null = null;
    let best = Infinity;
    if (!seat) {
      for (const zn of zones) {
        const d = Math.hypot(zn.x - pos.current.x, zn.z - pos.current.z);
        if (d < zn.r && d < best) {
          best = d;
          zone = zn;
        }
      }
    }
    if (zone !== prompt.current) {
      prompt.current = zone;
      onPrompt(zone ? { kind: zone.kind, ...(zone.code ? { code: zone.code } : {}) } : null);
    }

    selfPos.current.x = pos.current.x;
    selfPos.current.z = pos.current.z;
    const g = group.current;
    if (g) {
      g.position.set(pos.current.x, 0, pos.current.z);
      g.rotation.y = ry.current;
    }

    const now = state.clock.elapsedTime;
    const s = sent.current;
    const x = round2(pos.current.x);
    const z = round2(pos.current.z);
    const r = round2(ry.current);
    if (!seat && placed.current && now - s.at >= 1 / CLIENT_MOVE_HZ && (x !== s.x || z !== s.z || Math.abs(r - s.ry) > 0.05)) {
      client.sendMove(x, z, r);
      sent.current = { x, z, ry: r, at: now };
    }

    // Follow camera; higher and a little further back on portrait screens so more of the hall fits.
    const portrait = size.width < size.height;
    const height = portrait ? 11.5 : 9;
    const back = portrait ? 11.5 : 10.5;
    const k = 1 - Math.exp(-dt * 5);
    camera.position.x += (pos.current.x - camera.position.x) * k;
    camera.position.y += (height - camera.position.y) * k;
    camera.position.z += (pos.current.z + back - camera.position.z) * k;
    lookAt.current.lerp(scratch.current.set(pos.current.x, 0.8, pos.current.z - 1), k);
    camera.lookAt(lookAt.current);
  });

  return (
    <group ref={group}>
      <Avatar look={look} motion={motion} />
      {snack && <Snack snack={snack} />}
    </group>
  );
}

function RemotePlayer({ player, tags }: { player: PlayerView; tags: TagRegistry }) {
  const sitting = player.seat !== undefined;
  const group = useRef<THREE.Group>(null);
  useTagAnchor(tags, player.id, group);
  const motion = useRef<Motion>({ speed: 0 });
  const current = useRef({ x: player.target.x, z: player.target.z, ry: player.target.ry });

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const c = current.current;
    const t = player.target;
    const k = 1 - Math.exp(-dt * 10);
    const dx = (t.x - c.x) * k;
    const dz = (t.z - c.z) * k;
    c.x += dx;
    c.z += dz;
    c.ry = lerpAngle(c.ry, t.ry, k);
    const speed = dt > 0 ? Math.hypot(dx, dz) / dt / WALK_SPEED : 0;
    motion.current.speed += (Math.min(1, speed) - motion.current.speed) * k;
    motion.current.sitting = sitting;
    if (group.current) {
      group.current.position.set(c.x, 0, c.z);
      group.current.rotation.y = c.ry;
    }
  });

  return (
    <group ref={group} position={[player.target.x, 0, player.target.z]}>
      <Avatar look={player.look} motion={motion} />
      {player.snack && <Snack snack={player.snack} />}
    </group>
  );
}

function SpeechBubble({ text }: { text: string }) {
  return (
    <div className="bubble" data-testid="bubble">
      {text}
    </div>
  );
}

/** Static spots that speak when you walk up (portraits, tombstones): bubble only, no name tag. */
function TalkerAnchor({
  talker,
  tags,
  selfPos,
  onTalk,
}: {
  talker: Talker;
  tags: TagRegistry;
  selfPos: RefObject<{ x: number; z: number }>;
  onTalk: (tagId: string, text: string) => void;
}) {
  const anchor = useRef<THREE.Group>(null);
  const near = useRef(false);
  const line = useRef(0);
  const last = useRef(-Infinity);
  useTagAnchor(tags, `talker:${talker.id}`, anchor);
  useFrame(() => {
    const me = selfPos.current;
    if (!me) return;
    const isNear = Math.hypot(me.x - talker.x, me.z - talker.z) < talker.r;
    if (isNear && !near.current && performance.now() - last.current > 6000) {
      last.current = performance.now();
      onTalk(`talker:${talker.id}`, talker.lines[line.current % talker.lines.length] as string);
      line.current += 1;
    }
    near.current = isNear;
  });
  return <group ref={anchor} position={[talker.x, 0.2, talker.z]} />;
}

function Environment({
  place,
  selfPos,
  doors,
  screen,
}: {
  place: Place;
  selfPos: RefObject<{ x: number; z: number }>;
  doors: readonly DoorInfo[];
  screen: HTMLVideoElement | HTMLCanvasElement | null;
}) {
  if (place.kind === "room") {
    return (
      <RoomInterior name={`${place.room.floor}${place.room.slot} · ${place.room.name}`} decor={place.room.decor} capacity={place.room.capacity} screen={screen} />
    );
  }
  const floor = floorOfPlace(place) ?? 1;
  const elevator = ELEVATORS[floor];
  return (
    <>
      {floor === 1 && (
        <>
          <Lights />
          <LobbyHall />
          <Decor />
        </>
      )}
      {floor === 2 && <Gallery selfPos={selfPos} />}
      {floor === 3 && <Greenhouse selfPos={selfPos} />}
      {floor === 4 && <Canteen />}
      {floor === 5 && <Rooftop />}
      {floor <= 3 && <RoomDoors floor={floor} doors={doors} backing={floor === 3} />}
      {floor !== 4 && <Tables tables={FLOOR_TABLES[floor]} palette={FLOOR_PALETTE[floor]} />}
      <Elevator x={elevator.door.x} z={elevator.door.z} facing={elevator.facing} floor={floor} selfPos={selfPos} />
    </>
  );
}

export function WorldScene({
  client,
  place,
  selfId,
  players,
  bubbles,
  look,
  name,
  onPrompt,
  voiceMarks,
  candies,
  doors,
  onStand,
  screen,
}: {
  client: PresenceClient;
  place: Place;
  /** Live door labels for the current floor. */
  doors: readonly DoorInfo[];
  /** Ask the server to stand us up (walking while seated). */
  onStand: () => void;
  /** What the room's big screen shows: the shared screen's <video> or the slide <canvas>. */
  screen: HTMLVideoElement | HTMLCanvasElement | null;
  /** Voice state per public ID ("self" for us). */
  voiceMarks: ReadonlyMap<string, VoiceMark>;
  selfId: string | null;
  players: readonly PlayerView[];
  bubbles: ReadonlyMap<string, Bubble>;
  look: Look;
  name: string;
  /** Prompt for this scene; `scene` lets the HUD ignore late calls from a scene that is already gone. */
  onPrompt: (prompt: ({ scene: string } & ScenePrompt) | null) => void;
  /** Candy ids already found (hidden from the scene). */
  candies: readonly string[];
}) {
  const inLobby = place.kind === "lobby";
  // A new key remounts the environment and the local player when we change scene.
  const sceneKey = sceneKeyFor(place);
  const floor = floorOfPlace(place);
  const selfBubble = selfId ? bubbles.get(selfId) : undefined;
  const [tags] = useState(() => new TagRegistry());
  const others = players.filter((p) => p.id !== selfId);
  const selfPos = useRef({ x: 0, z: 100 });
  const roomGame = place.kind === "room" ? place.room.game : null;
  const npcs = useMemo(
    () => (roomGame !== null ? [roomHost(roomGame)] : floor === null || floor === 1 ? LOBBY_NPCS : FLOOR_NPCS[floor]),
    [roomGame, floor],
  );
  const talkers = floor === null || floor === 1 ? [] : FLOOR_TALKERS[floor];
  const layout = layoutForPlace(place);
  const selfSeatRef = players.find((p) => p.id === selfId)?.seat;
  const selfSeat = useMemo(
    () => (selfSeatRef ? (findSeat(place, selfSeatRef.table, selfSeatRef.seat)?.seat ?? null) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selfSeatRef?.table, selfSeatRef?.seat, sceneKey],
  );
  const zones = useMemo(() => promptZones(place), [sceneKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // NPC speech bubbles are local only (each guest hears their own tips).
  const [npcSay, setNpcSay] = useState<ReadonlyMap<string, { id: number; text: string }>>(new Map());
  const sayId = useRef(0);
  const say = useCallback((tagId: string, text: string, ms = 6000) => {
    const id = ++sayId.current;
    setNpcSay((m) => new Map(m).set(tagId, { id, text }));
    window.setTimeout(() => {
      setNpcSay((m) => {
        if (m.get(tagId)?.id !== id) return m;
        const next = new Map(m);
        next.delete(tagId);
        return next;
      });
    }, ms);
  }, []);
  useEffect(() => {
    setNpcSay(new Map());
    if (sceneKey !== "lobby") return;
    const timer = window.setTimeout(() => say(npcTagId(RECEPTIONIST_ID), greeting(name), 7000), 1200);
    return () => window.clearTimeout(timer);
    // Greet once per lobby visit, not on every rename.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey, say]);
  const collect = useCallback((id: string) => client.sendCollect(id), [client]);
  const promptForScene = useCallback((p: ScenePrompt | null) => onPrompt(p ? { scene: sceneKey, ...p } : null), [onPrompt, sceneKey]);

  return (
    <div className="lobby-stage">
      <Canvas
        className="lobby-canvas"
        dpr={[1, 1.75]}
        camera={{ fov: 50, position: [0, 10, 18], near: 0.1, far: 320 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        // M18: a little brighter overall. Signs, screens and candles use toneMapped={false}, so they keep their glow.
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 1.15;
        }}
      >
        <color attach="background" args={["#0b0614"]} />
        <fog attach="fog" args={[floor === 5 ? "#120c22" : "#0b0614", floor === 5 ? 40 : 20, floor === 5 ? 200 : 60]} />
        <group key={sceneKey}>
          <Environment place={place} selfPos={selfPos} doors={doors} screen={screen} />
          <LocalPlayer
            client={client}
            look={look}
            tags={tags}
            layout={layout}
            zones={zones}
            onPrompt={promptForScene}
            selfPos={selfPos}
            snack={players.find((p) => p.id === selfId)?.snack}
            seat={selfSeat}
            onStand={onStand}
          />
          <Npcs defs={npcs} tags={tags} selfPos={selfPos} onTalk={say} />
          {talkers.map((t) => (
            <TalkerAnchor key={t.id} talker={t} tags={tags} selfPos={selfPos} onTalk={say} />
          ))}
          {floor !== null && <Candies floor={floor} found={candies} selfPos={selfPos} onCollect={collect} />}
        </group>
        {others.map((p) => (
          <RemotePlayer key={p.id} player={p} tags={tags} />
        ))}
        {/* Last, so it projects after the camera and avatars have moved this frame. */}
        <TagProjector registry={tags} />
      </Canvas>
      <div className="nametags" aria-label={inLobby ? "Guests in the lobby" : "Guests here"}>
        <div ref={tags.element(SELF_TAG)} className="tag">
          {selfBubble && <SpeechBubble key={selfBubble.id} text={selfBubble.text} />}
          <div className="nametag nametag--self" data-testid="nametag-self" data-voice={voiceMarks.get("self")}>
            {name}
          </div>
        </div>
        {talkers.map((t) => {
          const line = npcSay.get(`talker:${t.id}`);
          return (
            <div key={`${sceneKey}:${t.id}`} ref={tags.element(`talker:${t.id}`)} className="tag">
              {line && (
                <div key={line.id} className="bubble bubble--npc" data-testid="npc-bubble">
                  {line.text}
                </div>
              )}
            </div>
          );
        })}
        {npcs.map((npc) => {
          const line = npcSay.get(npcTagId(npc.id));
          return (
            <div key={`${sceneKey}:${npc.id}`} ref={tags.element(npcTagId(npc.id))} className="tag">
              {line && (
                <div key={line.id} className="bubble bubble--npc" data-testid="npc-bubble">
                  {line.text}
                </div>
              )}
              <div className="nametag nametag--npc" data-testid="nametag-npc">
                👻 {npc.name}
              </div>
            </div>
          );
        })}
        {others.map((p) => {
          const bubble = bubbles.get(p.id);
          return (
            <div key={p.id} ref={tags.element(p.id)} className="tag">
              {bubble && <SpeechBubble key={bubble.id} text={bubble.text} />}
              <div className="nametag" data-testid="nametag" data-voice={voiceMarks.get(p.id)}>
                {p.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
