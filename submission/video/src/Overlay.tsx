import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { clamp01, easeOutCubic } from "./three/random";

// DOM layers drawn over the 3D canvas: vignette, flashes, fades and text.

export function Vignette({ strength = 0.85 }: { strength?: number }) {
  return (
    <AbsoluteFill
      style={{ background: `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(5,2,10,${strength}) 100%)`, pointerEvents: "none" }}
    />
  );
}

/** A warm flash from the screen point (x%, y%), 1 → 0 over `length` frames. */
export function Flash({ frame, at, length, x = 50, y = 55 }: { frame: number; at: number; length: number; x?: number; y?: number }) {
  if (frame < at || frame > at + length) return null;
  const t = (frame - at) / length;
  const o = (1 - t) ** 2;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${x}% ${y}%, rgba(255,250,230,${o}) 0%, rgba(255,170,60,${o * 0.85}) ${18 + t * 30}%, rgba(255,90,20,${o * 0.3}) ${45 + t * 30}%, rgba(0,0,0,0) 80%)`,
        mixBlendMode: "screen",
      }}
    />
  );
}

/** Black over everything: 1 at `from` → 0 at `to` (fade in), or the reverse when from > to. */
export function Black({ frame, from, to }: { frame: number; from: number; to: number }) {
  const o = interpolate(frame, [Math.min(from, to), Math.max(from, to)], from < to ? [1, 0] : [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (o <= 0) return null;
  return <AbsoluteFill style={{ background: "#000", opacity: o }} />;
}

/** Fades and lifts in at `at` over 14 frames; optional fade out at `out`. */
export function Reveal({ frame, at, out, children, style }: { frame: number; at: number; out?: number; children: ReactNode; style?: CSSProperties }) {
  const inT = easeOutCubic((frame - at) / 14);
  const outT = out === undefined ? 0 : clamp01((frame - out) / 10);
  const o = inT * (1 - outT);
  if (o <= 0) return null;
  return <div style={{ opacity: o, transform: `translateY(${(1 - inT) * 26 - outT * 12}px)`, filter: `blur(${(1 - inT) * 6}px)`, ...style }}>{children}</div>;
}

export const TEXT = {
  line: {
    fontFamily: "Nunito",
    fontWeight: 800,
    color: "#fff3d6",
    textShadow: "0 0 18px rgba(255,122,26,0.55), 0 2px 6px rgba(0,0,0,0.8)",
    textAlign: "center",
  },
  small: {
    fontFamily: "Nunito",
    fontWeight: 600,
    color: "#d9cdf5",
    textShadow: "0 2px 6px rgba(0,0,0,0.9)",
    textAlign: "center",
  },
  title: {
    fontFamily: "Creepster",
    fontWeight: 400,
    color: "#ffcf7a",
    textShadow: "0 0 30px #ff7a1a, 0 0 70px rgba(255,122,26,0.6)",
    textAlign: "center",
  },
} satisfies Record<string, CSSProperties>;

/**
 * Letters that rise and glow in one after another from `at` (`stagger` frames apart). Every letter is laid out
 * from the start, so the line stays centred while it appears.
 */
export function Letters({ text, frame, at, stagger = 0.9, style }: { text: string; frame: number; at: number; stagger?: number; style?: CSSProperties }) {
  return (
    <div style={style}>
      {Array.from(text).map((ch, i) => {
        const t = easeOutCubic((frame - at - i * stagger) / 10);
        return (
          <span key={i} style={{ display: "inline-block", whiteSpace: "pre", opacity: t, transform: `translateY(${(1 - t) * 18}px) scale(${0.85 + 0.15 * t})` }}>
            {ch}
          </span>
        );
      })}
    </div>
  );
}
