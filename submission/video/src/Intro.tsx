import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, Html5Audio, staticFile, useCurrentFrame } from "remotion";
import { useFontsReady } from "./fonts";
import { Black, Flash, Letters, Reveal, TEXT, Vignette } from "./Overlay";
import { Bats, type BatFlight } from "./three/Bats";
import { CameraRig } from "./three/CameraRig";
import { Ghost } from "./three/Ghost";
import { Pedestal, Pumpkin, PUMPKIN_CENTRE } from "./three/Pumpkin";
import { easeInCubic, easeInOutCubic, easeOutCubic, progress } from "./three/random";
import { IntroShards } from "./three/Shards";
import { Shockwave, Sign } from "./three/Sign";
import type { Vec3 } from "./three/textPoints";
import { PALETTE } from "./three/textures";
import { Lights, World } from "./three/World";
import { HEIGHT, INTRO, SIGN, WIDTH, signFlicker } from "./timeline";

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixV = (a: Vec3, b: Vec3, t: number): Vec3 => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

const BATS: BatFlight[] = [
  // crossing the path while the camera flies in
  { from: [-15, 5, 15], to: [15, 7, 6], start: 6, end: 66, scale: 1.3, flap: 0.9 },
  { from: [13, 4, 20], to: [-13, 6.5, 11], start: 18, end: 76, scale: 1.1, flap: 1.05 },
  { from: [-11, 7.5, 2], to: [11, 5.5, -7], start: 28, end: 92, scale: 1.0, flap: 0.95 },
  // scattered by the blast, toward and past the camera
  ...(
    [
      [-9, 7, 12],
      [9, 8, 11],
      [-12, 3.5, 6],
      [12, 4, 5],
      [-4, 10, 9],
      [5, 9.5, 12],
    ] as Vec3[]
  ).map((to, i): BatFlight => ({ from: PUMPKIN_CENTRE, to, start: INTRO.burst + 1 + (i % 3), end: INTRO.burst + 44 + i * 3, scale: 0.9 + (i % 2) * 0.3, flap: 1.25 })),
];

const PUMPKIN_AT: Vec3 = PUMPKIN_CENTRE;
const SIGN_AT: Vec3 = [0, SIGN.y, SIGN.z];

function camera(f: number): { position: Vec3; target: Vec3; roll: number; fov: number } {
  const approach = easeInOutCubic(progress(f, 0, 80));
  // Dolly zoom while the pumpkin charges: push in and widen the lens, so the pumpkin keeps its size and the
  // graveyard behind it stretches away.
  const dolly = easeInCubic(progress(f, INTRO.chargeStart, INTRO.burst));
  const settle = easeOutCubic(progress(f, INTRO.burst, INTRO.gatherEnd - 5));
  const drift = progress(f, INTRO.gatherEnd - 5, INTRO.frames);
  const z = mix(30, 9, approach) - 1.8 * dolly + 3.3 * settle - 0.9 * drift;
  const y = mix(4.6, 2.6, approach) + 0.35 * settle;
  const x = Math.sin(f * 0.035) * 0.9 * (1 - approach) + Math.sin(f * 0.02) * 0.25 * drift;
  const fov = mix(mix(45, 55, dolly), 45, settle);
  const amp = f >= INTRO.burst ? 0.38 * Math.exp(-(f - INTRO.burst) / 6) : charge(f) * 0.03;
  const position: Vec3 = [x + Math.sin(f * 13.1) * amp, y + Math.cos(f * 17.3) * amp, z];
  const target = mixV(PUMPKIN_AT, SIGN_AT, easeInOutCubic(progress(f, INTRO.burst + 10, INTRO.gatherEnd - 2)));
  return { position, target, roll: Math.sin(f * 11.3) * amp * 0.12, fov };
}

const charge = (f: number) => easeInCubic(progress(f, INTRO.chargeStart, INTRO.burst));

export function Intro() {
  const frame = useCurrentFrame();
  const fonts = useFontsReady();
  const cam = camera(frame);
  const blast = 1 - progress(frame, INTRO.burst, INTRO.burst + 18);
  const fleeing = progress(frame, INTRO.burst, INTRO.burst + 10);
  return (
    <AbsoluteFill style={{ background: PALETTE.night }}>
      {fonts ? (
        <ThreeCanvas width={WIDTH} height={HEIGHT} camera={{ fov: 45, near: 0.1, far: 240, position: [0, 4.6, 30] }} gl={{ antialias: true }}>
          <color attach="background" args={[PALETTE.night]} />
          <fog attach="fog" args={[PALETTE.night, 14, 70]} />
          <CameraRig {...cam} />
          <Lights />
          <World frame={frame} />
          <Pedestal />
          <Pumpkin frame={frame} charge={charge(frame)} visible={frame < INTRO.burst} />
          {frame >= INTRO.burst && blast > 0 ? (
            <pointLight position={PUMPKIN_CENTRE} color="#ffb347" intensity={260 * blast * blast} distance={34} decay={1.4} />
          ) : null}
          <Shockwave progress={progress(frame, INTRO.burst, INTRO.burst + 16)} position={PUMPKIN_CENTRE} />
          <group rotation={[-Math.PI / 2, 0, 0]}>
            <Shockwave progress={progress(frame, INTRO.burst + 1, INTRO.burst + 22)} position={[0, 0, 0.06]} />
          </group>
          <IntroShards frame={frame} />
          <Sign brightness={signFlicker("intro", frame)} backing={progress(frame, INTRO.burstEnd, INTRO.gatherEnd)} />
          <Bats frame={frame} flights={BATS} />
          <Ghost frame={frame} position={[-3.4 - fleeing * 4, 1.0 + fleeing * 1.5, 3]} opacity={progress(frame, 22, 44) * (1 - fleeing)} />
          <Ghost frame={frame + 40} position={[6.2, 1.4, -2.5]} opacity={progress(frame, 34, 56)} />
        </ThreeCanvas>
      ) : null}
      <Vignette />
      <Flash frame={frame} at={INTRO.burst} length={15} y={52} />
      <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 770 }}>
        <Letters text="Check in. Hang out. Play till dawn." frame={frame} at={INTRO.taglineIn} stagger={0.7} style={{ ...TEXT.line, fontSize: 64, letterSpacing: 1 }} />
        <Reveal frame={frame} at={INTRO.taglineIn + 18} style={{ ...TEXT.small, fontSize: 30, marginTop: 18, letterSpacing: 2 }}>
          A haunted hotel built with Kiro · Kiroween 2026
        </Reveal>
      </AbsoluteFill>
      <Black frame={frame} from={0} to={14} />
      <Black frame={frame} from={INTRO.frames} to={INTRO.fadeOut} />
      <Html5Audio src={staticFile("intro.wav")} />
    </AbsoluteFill>
  );
}
