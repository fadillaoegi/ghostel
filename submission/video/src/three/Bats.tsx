import type { Vec3 } from "./textPoints";

export interface BatFlight {
  from: Vec3;
  to: Vec3;
  start: number;
  end: number;
  scale: number;
  /** Wing beats per frame (radians). */
  flap: number;
}

function Bat({ position, heading, wing, scale }: { position: Vec3; heading: number; wing: number; scale: number }) {
  return (
    <group position={position} rotation={[0, heading, 0]} scale={scale}>
      <mesh>
        <icosahedronGeometry args={[0.14, 0]} />
        <meshStandardMaterial color="#1a0f24" flatShading />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} rotation={[0, 0, side * wing]}>
          <mesh position={[side * 0.32, 0, 0]} rotation={[0, 0, side * 0.15]}>
            <boxGeometry args={[0.5, 0.02, 0.26]} />
            <meshStandardMaterial color="#24133a" flatShading />
          </mesh>
          <mesh position={[side * 0.62, -0.03, -0.02]} rotation={[0, 0, -side * 0.35]}>
            <boxGeometry args={[0.24, 0.02, 0.16]} />
            <meshStandardMaterial color="#24133a" flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Bats flying along straight lines with a little bob; position and wing angle are functions of the frame. */
export function Bats({ frame, flights }: { frame: number; flights: readonly BatFlight[] }) {
  return (
    <>
      {flights.map((b, i) => {
        if (frame < b.start || frame > b.end) return null;
        const t = (frame - b.start) / (b.end - b.start);
        const pos: Vec3 = [
          b.from[0] + (b.to[0] - b.from[0]) * t,
          b.from[1] + (b.to[1] - b.from[1]) * t + Math.sin(frame * 0.35 + i) * 0.25,
          b.from[2] + (b.to[2] - b.from[2]) * t,
        ];
        const heading = Math.atan2(b.to[0] - b.from[0], b.to[2] - b.from[2]);
        const wing = Math.sin(frame * b.flap + i * 1.7) * 0.75;
        return <Bat key={i} position={pos} heading={heading} wing={wing} scale={b.scale} />;
      })}
    </>
  );
}
