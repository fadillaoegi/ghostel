import { doorsOnFloor, type DoorDef, type DoorInfo, type RoomAccess } from "@ghostel/shared";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

const FRAME = "#2a1810";
const LEAF = "#4a2d1b";
const PANEL = "#5c3a22";
const BRASS = "#c9a227";

/** Accent per door state: plaque glow and the light spilling out of an open door. */
const ACCENT: Record<RoomAccess | "vacant", { glow: string; text: string }> = {
  open: { glow: "#ff9a2e", text: "#ffe9c4" },
  password: { glow: "#a970ff", text: "#efe2ff" },
  locked: { glow: "#ff3b3b", text: "#ffd9d9" },
  vacant: { glow: "#6b7a99", text: "#c9d2e6" },
};
const LOCK_ICON: Record<RoomAccess, string> = { open: "🔓", locked: "🔒", password: "🔑" };

const PLAQUE_W = 512;
const PLAQUE_H = 256;

/** The door's number plaque: code, room name (or "Vacant") and who is inside, drawn on a canvas. */
function usePlaqueTexture(code: string, title: string, status: string, accent: { glow: string; text: string }): THREE.CanvasTexture {
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = PLAQUE_W;
    c.height = PLAQUE_H;
    return c;
  }, []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);
  const [, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const draw = () => {
      if (cancelled) return;
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      ctx.clearRect(0, 0, PLAQUE_W, PLAQUE_H);
      // Board with a brass rim.
      ctx.fillStyle = "#1a0f14";
      ctx.strokeStyle = BRASS;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.roundRect(8, 8, PLAQUE_W - 16, PLAQUE_H - 16, 28);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = accent.glow;
      const line = (text: string, font: string, px: number, y: number, color: string) => {
        ctx.font = `${px}px ${font}`;
        const fit = (PLAQUE_W - 60) / Math.max(1, ctx.measureText(text).width);
        const size = fit < 1 ? px * fit : px;
        ctx.font = `${size}px ${font}`;
        ctx.shadowBlur = size * 0.35;
        ctx.fillStyle = color;
        ctx.fillText(text, PLAQUE_W / 2, y);
      };
      line(code, "Creepster", 104, 78, BRASS);
      line(title, "Nunito", 50, 160, accent.text);
      line(status, "Nunito", 34, 212, accent.glow);
      texture.needsUpdate = true;
      setVersion((v) => v + 1);
    };
    draw();
    Promise.all([document.fonts.load("104px Creepster"), document.fonts.load("50px Nunito")]).then(draw, draw);
    return () => {
      cancelled = true;
    };
  }, [canvas, texture, code, title, status, accent]);

  return texture;
}

function Plaque({ info, width }: { info: DoorInfo; width: number }) {
  const room = info.room;
  const accent = ACCENT[room ? room.access : "vacant"];
  const title = room ? `${LOCK_ICON[room.access]} ${room.name}` : "Vacant";
  const status = room ? (info.occupants > 0 ? `👻 ${info.occupants} inside` : "Empty right now") : "Book this room";
  const texture = usePlaqueTexture(info.code, title, status, accent);
  return (
    <mesh>
      <planeGeometry args={[width, width / 2]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

const ROTATION: Record<DoorDef["facing"], number> = { north: 0, west: Math.PI / 2, east: -Math.PI / 2 };

/** A room door on a wall. Occupied rooms stand ajar with their light spilling out. */
function RoomDoor({ door, info, backing }: { door: DoorDef; info: DoorInfo; backing: boolean }) {
  const occupied = info.occupants > 0;
  const accent = ACCENT[info.room ? info.room.access : "vacant"];
  const side = door.facing !== "north";
  return (
    <group>
      <group position={[door.x, 0, door.z]} rotation={[0, ROTATION[door.facing], 0]}>
        {backing && (
          <mesh position={[0, 2.1, -0.2]}>
            <boxGeometry args={[2.5, 4.2, 0.4]} />
            <meshStandardMaterial color="#2b2236" roughness={0.95} />
          </mesh>
        )}
        {/* frame */}
        <mesh position={[0, 1.5, 0.04]}>
          <boxGeometry args={[1.8, 3, 0.16]} />
          <meshStandardMaterial color={FRAME} roughness={0.8} flatShading />
        </mesh>
        {/* the room beyond: dark when empty, lit when someone is inside */}
        <mesh position={[0, 1.35, 0.125]}>
          <planeGeometry args={[1.4, 2.65]} />
          <meshStandardMaterial
            color={occupied ? accent.glow : "#0b0614"}
            emissive={occupied ? accent.glow : "#000000"}
            emissiveIntensity={occupied ? 1.4 : 0}
            toneMapped={!occupied}
          />
        </mesh>
        {/* leaf, hinged on the left */}
        <group position={[-0.7, 0, 0.16]} rotation={[0, occupied ? -0.75 : 0, 0]}>
          <mesh position={[0.7, 1.35, 0]}>
            <boxGeometry args={[1.4, 2.65, 0.07]} />
            <meshStandardMaterial color={LEAF} roughness={0.75} flatShading />
          </mesh>
          {[0.75, 1.95].map((y) => (
            <mesh key={y} position={[0.7, y, 0.04]}>
              <boxGeometry args={[1.05, 0.95, 0.03]} />
              <meshStandardMaterial color={PANEL} flatShading />
            </mesh>
          ))}
          <mesh position={[1.22, 1.3, 0.07]}>
            <icosahedronGeometry args={[0.065, 0]} />
            <meshStandardMaterial color={BRASS} emissive="#ffb347" emissiveIntensity={0.6} />
          </mesh>
        </group>
        {/* lintel */}
        <mesh position={[0, 3.08, 0.08]}>
          <boxGeometry args={[2.1, 0.18, 0.24]} />
          <meshStandardMaterial color={BRASS} metalness={0.5} roughness={0.45} />
        </mesh>
        {/* doormat */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0.75]}>
          <planeGeometry args={[1.5, 0.9]} />
          <meshStandardMaterial color={info.room ? "#5c0f1f" : "#2a2438"} roughness={1} />
        </mesh>
        {/* North doors carry the plaque above the frame, facing the camera. */}
        {!side && (
          <group position={[0, 3.62, 0.14]}>
            <Plaque info={info} width={1.9} />
          </group>
        )}
      </group>
      {/* Side-wall doors are seen edge-on, so their plaque hangs from a bracket and faces the camera. */}
      {side && (
        <group position={[door.x + (door.facing === "west" ? 1.15 : -1.15), 3.55, door.z]}>
          <mesh position={[door.facing === "west" ? -0.2 : 0.2, 0.58, 0]}>
            <boxGeometry args={[1.9, 0.06, 0.06]} />
            <meshStandardMaterial color={BRASS} metalness={0.6} roughness={0.4} />
          </mesh>
          <Plaque info={info} width={1.8} />
        </group>
      )}
    </group>
  );
}

/** Every room door on a floor, labelled with the live state the server sends. */
export function RoomDoors({ floor, doors, backing = false }: { floor: number; doors: readonly DoorInfo[]; backing?: boolean }) {
  const defs = doorsOnFloor(floor);
  return (
    <group>
      {defs.map((d) => {
        const info = doors.find((i) => i.code === d.code) ?? { code: d.code, floor: d.floor, slot: d.slot, room: null, occupants: 0 };
        return <RoomDoor key={d.code} door={d} info={info} backing={backing} />;
      })}
    </group>
  );
}
