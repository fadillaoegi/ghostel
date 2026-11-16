// One timeline for picture and sound (scripts/make-audio.ts imports it too).

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** Intro: approach, charge, burst, gather into the sign, tagline, fade. */
export const INTRO = {
  frames: 210,
  approachEnd: 75,
  chargeStart: 60,
  burst: 90,
  burstEnd: 105,
  gatherEnd: 140,
  ignite: 140,
  shardsGone: 152,
  taglineIn: 150,
  fadeOut: 196,
} as const;

/** Outro: lit sign, flicker, burst into embers and bats, credits, fade. */
export const OUTRO = {
  frames: 210,
  thanksIn: 12,
  flickerStart: 62,
  burst: 90,
  embersEnd: 176,
  creditsIn: 112,
  fadeOut: 192,
} as const;

export const seconds = (frame: number) => frame / FPS;

/** The sign that the shards build (intro) and break (outro). World units. */
export const SIGN = { text: "GHOSTEL", width: 9.6, height: 2.4, y: 3.0, z: 0 } as const;

// Frames where the neon is off (intro: while it ignites; outro: while it fails before the burst).
const IGNITE_OFF = new Set([143, 144, 147]);
const FLICKER_OFF = new Set([65, 66, 71, 75, 76, 77, 81, 84, 85, 87, 88]);

/**
 * Brightness of the neon sign (0 = dark, 1 = lit, above 1 = the surge just before it bursts).
 * The picture and the neon hum in the audio both read this, so every flicker is heard on the same frame.
 */
export function signFlicker(scene: "intro" | "outro", frame: number): number {
  if (scene === "intro") {
    if (frame < INTRO.ignite) return 0;
    if (IGNITE_OFF.has(frame)) return 0.12;
    return Math.min(1, (frame - INTRO.ignite) / 10 + 0.35);
  }
  if (frame >= OUTRO.burst) return 0;
  if (frame >= OUTRO.burst - 1) return 1.6;
  if (frame < OUTRO.flickerStart) return 1;
  return FLICKER_OFF.has(frame) ? 0.1 : 1;
}
