import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, Html5Audio, staticFile, useCurrentFrame } from "remotion";
import { useFontsReady } from "./fonts";
import { Black, Flash, Letters, Reveal, TEXT, Vignette } from "./Overlay";
import { Bats, type BatFlight } from "./three/Bats";
import { CameraRig } from "./three/CameraRig";
import { Ghost } from "./three/Ghost";
import { Pumpkin } from "./three/Pumpkin";
import { easeInOutCubic, progress, seeded } from "./three/random";
import { OutroShards } from "./three/Shards";
import { Shockwave, Sign } from "./three/Sign";
import type { Vec3 } from "./three/textPoints";
import { PALETTE } from "./three/textures";
import { Lights, World } from "./three/World";
import { HEIGHT, OUTRO, SIGN, WIDTH, signFlicker } from "./timeline";

export type OutroProps = {
  /** The live app URL, shown under the repo link when set (pass it with --props at render time). */
  appUrl: string;
};

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Bats burst out of the letters with the embers and fly off past the camera. */
const BATS: BatFlight[] = (() => {
  const rng = seeded(41);
  return Array.from({ length: 9 }, (_, i): BatFlight => {
    const x = (i / 8 - 0.5) * SIGN.width * 0.9;
    const side = x < 0 ? -1 : 1;
    return {
      from: [x, SIGN.y + (rng() - 0.5), SIGN.z + 0.2],
      to: [side * (8 + rng() * 8), SIGN.y + 3 + rng() * 6, 6 + rng() * 9],
      start: OUTRO.burst + 1 + (i % 3),
      end: OUTRO.burst + 46 + Math.floor(rng() * 20),
      scale: 0.9 + rng() * 0.5,
      flap: 1.15 + rng() * 0.3,
    };
  });
})();

const SIGN_AT: Vec3 = [0, SIGN.y, SIGN.z];

function camera(f: number): { position: Vec3; target: Vec3; roll: number } {
  const t = easeInOutCubic(progress(f, 0, OUTRO.frames));
  const orbit = Math.sin(t * Math.PI * 0.5) * 0.35;
  const dist = mix(8.5, 14, t);
  const amp = f >= OUTRO.burst ? 0.3 * Math.exp(-(f - OUTRO.burst) / 7) : 0;
  const position: Vec3 = [Math.sin(orbit) * dist + Math.sin(f * 12.7) * amp, mix(3, 4.2, t) + Math.cos(f * 16.1) * amp, Math.cos(orbit) * dist];
  return { position, target: [0, mix(SIGN.y, 3.5, t), 0], roll: Math.sin(f * 10.9) * amp * 0.12 };
}

export function Outro({ appUrl }: OutroProps) {
  const frame = useCurrentFrame();
  const fonts = useFontsReady();
  const brightness = signFlicker("outro", frame);
  const blast = 1 - progress(frame, OUTRO.burst, OUTRO.burst + 16);
  const backdrop = progress(frame, OUTRO.creditsIn - 12, OUTRO.creditsIn + 8);
  return (
    <AbsoluteFill style={{ background: PALETTE.night }}>
      {fonts ? (
        <ThreeCanvas width={WIDTH} height={HEIGHT} camera={{ fov: 45, near: 0.1, far: 240, position: [0, 3, 8.5] }} gl={{ antialias: true }}>
          <color attach="background" args={[PALETTE.night]} />
          <fog attach="fog" args={[PALETTE.night, 14, 70]} />
          <CameraRig {...camera(frame)} />
          <Lights />
          <World frame={frame} />
          {/* two small jack-o'-lanterns at the foot of the sign */}
          <group position={[-3.9, -1.2 * 0.45, 2.2]} scale={0.45}>
            <Pumpkin frame={frame} charge={0} visible />
          </group>
          <group position={[3.9, -1.2 * 0.45, 2.2]} scale={0.45}>
            <Pumpkin frame={frame + 17} charge={0} visible />
          </group>
          <Sign brightness={brightness} backing={1} />
          {frame >= OUTRO.burst && blast > 0 ? (
            <pointLight position={[0, SIGN.y, 1]} color="#ffb347" intensity={200 * blast * blast} distance={30} decay={1.4} />
          ) : null}
          <Shockwave progress={progress(frame, OUTRO.burst, OUTRO.burst + 18)} position={[0, SIGN.y, SIGN.z + 0.1]} />
          <OutroShards frame={frame} />
          <Bats frame={frame} flights={BATS} />
          <Ghost frame={frame} position={[-5.8, 1.1, 1.5]} opacity={progress(frame, 4, 26)} />
          <Ghost frame={frame + 55} position={[6.0, 1.5, -1.0]} opacity={progress(frame, 14, 36)} />
        </ThreeCanvas>
      ) : null}
      <Vignette />
      <Flash frame={frame} at={OUTRO.burst} length={13} y={42} />
      <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 120 }}>
        <Reveal frame={frame} at={OUTRO.thanksIn} out={OUTRO.burst - 8} style={{ ...TEXT.line, fontSize: 60 }}>
          Thanks for checking in.
        </Reveal>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, rgba(8,3,16,${0.7 * backdrop}) 0%, rgba(8,3,16,${0.35 * backdrop}) 60%, rgba(0,0,0,0) 100%)` }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <Letters text="GHOSTEL" frame={frame} at={OUTRO.creditsIn} stagger={2} style={{ ...TEXT.title, fontSize: 200, lineHeight: 1 }} />
        <Reveal frame={frame} at={OUTRO.creditsIn + 14} style={{ ...TEXT.line, fontSize: 50, marginTop: 10 }}>
          Check in. Hang out. Play till dawn.
        </Reveal>
        <Reveal frame={frame} at={OUTRO.creditsIn + 26} style={{ ...TEXT.small, fontSize: 32, marginTop: 44, letterSpacing: 1 }}>
          Built with Kiro for Kiroween 2026
        </Reveal>
        <Reveal frame={frame} at={OUTRO.creditsIn + 36} style={{ ...TEXT.small, fontSize: 30, marginTop: 14, color: "#43ffb0" }}>
          github.com/fadillaoegi/ghostel
        </Reveal>
        {appUrl ? (
          <Reveal frame={frame} at={OUTRO.creditsIn + 44} style={{ ...TEXT.small, fontSize: 30, marginTop: 8, color: "#ffcf7a" }}>
            {appUrl.replace(/^https?:\/\//, "")}
          </Reveal>
        ) : null}
      </AbsoluteFill>
      <Black frame={frame} from={0} to={12} />
      <Black frame={frame} from={OUTRO.frames} to={OUTRO.fadeOut} />
      <Html5Audio src={staticFile("outro.wav")} />
    </AbsoluteFill>
  );
}
