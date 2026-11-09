import type { SeatDef, TableDef } from "@ghostel/shared";
import * as THREE from "three";
import { Candle } from "./Decor";

export interface TablePalette {
  top: string;
  wood: string;
  cloth?: string;
}

export const TABLE_PALETTES = {
  lobby: { top: "#3b2416", wood: "#2a1810", cloth: "#5c0f1f" },
  gallery: { top: "#4a2d1b", wood: "#2a1810", cloth: "#2b1d3a" },
  greenhouse: { top: "#5c4a2a", wood: "#3a2a18", cloth: "#1f3a2a" },
  diner: { top: "#e9d8a6", wood: "#c81d25" },
  rooftop: { top: "#4b3f5c", wood: "#2b2838" },
  room: { top: "#3b2416", wood: "#2a1810", cloth: "#5c0f1f" },
} as const satisfies Record<string, TablePalette>;

function Chair({ seat, color }: { seat: SeatDef; color: string }) {
  // The chair stands at the seat and faces the table; its back is on the far side.
  return (
    <group position={[seat.x, 0, seat.z]} rotation={[0, seat.ry, 0]}>
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[0.5, 0.08, 0.5]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      <mesh position={[0, 0.78, -0.24]}>
        <boxGeometry args={[0.5, 0.65, 0.07]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      {[
        [-0.2, -0.2],
        [0.2, -0.2],
        [-0.2, 0.2],
        [0.2, 0.2],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x as number, 0.2, z as number]}>
          <boxGeometry args={[0.06, 0.4, 0.06]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

function RoundTable({ table, palette, candle }: { table: TableDef; palette: TablePalette; candle: boolean }) {
  const r = table.seats.length > 2 ? 0.72 : 0.6;
  return (
    <group>
      <group position={[table.x, 0, table.z]}>
        <mesh position={[0, 0.76, 0]}>
          <cylinderGeometry args={[r, r, 0.07, 14]} />
          <meshStandardMaterial color={palette.top} roughness={0.6} flatShading />
        </mesh>
        {palette.cloth && (
          <mesh position={[0, 0.66, 0]}>
            <cylinderGeometry args={[r + 0.03, r + 0.12, 0.2, 14, 1, true]} />
            <meshStandardMaterial color={palette.cloth} roughness={0.9} side={THREE.DoubleSide} />
          </mesh>
        )}
        <mesh position={[0, 0.38, 0]}>
          <cylinderGeometry args={[0.07, 0.09, 0.76, 6]} />
          <meshStandardMaterial color={palette.wood} />
        </mesh>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.32, 0.36, 0.06, 8]} />
          <meshStandardMaterial color={palette.wood} />
        </mesh>
        {candle && <Candle position={[0, 0.8, 0]} height={0.22} />}
      </group>
      {table.seats.map((s, i) => (
        <Chair key={i} seat={s} color={palette.wood} />
      ))}
    </group>
  );
}

export function LongTable({ table, palette }: { table: TableDef; palette: TablePalette }) {
  const w = table.width ?? 3;
  const d = table.depth ?? 1.2;
  return (
    <group>
      <group position={[table.x, 0, table.z]}>
        <mesh position={[0, 0.78, 0]}>
          <boxGeometry args={[w, 0.08, d]} />
          <meshStandardMaterial color={palette.top} roughness={0.6} flatShading />
        </mesh>
        {palette.cloth && (
          <mesh position={[0, 0.83, 0]}>
            <boxGeometry args={[w * 0.92, 0.01, d * 0.4]} />
            <meshStandardMaterial color={palette.cloth} roughness={0.9} />
          </mesh>
        )}
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx}${sz}`} position={[sx * (w / 2 - 0.15), 0.38, sz * (d / 2 - 0.12)]}>
              <boxGeometry args={[0.1, 0.76, 0.1]} />
              <meshStandardMaterial color={palette.wood} />
            </mesh>
          )),
        )}
        {[-w / 3, 0, w / 3].map((x) => (
          <Candle key={x} position={[x, 0.82, 0]} height={0.24} />
        ))}
      </group>
      {table.seats.map((s, i) => (
        <Chair key={i} seat={s} color={palette.wood} />
      ))}
    </group>
  );
}

/** Every table of a scene with its chairs. Candles only on a few tables to keep the frame cheap. */
export function Tables({ tables, palette, candles = true }: { tables: readonly TableDef[]; palette: TablePalette; candles?: boolean }) {
  return (
    <group>
      {tables.map((t, i) =>
        t.shape === "long" ? (
          <LongTable key={t.id} table={t} palette={palette} />
        ) : (
          <RoundTable key={t.id} table={t} palette={palette} candle={candles && i % 2 === 0} />
        ),
      )}
    </group>
  );
}
