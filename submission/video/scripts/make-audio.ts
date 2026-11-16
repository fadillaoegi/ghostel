// Synthesizes the intro and outro soundtracks offline and writes them as WAV files into `public/`.
// Everything is made here from oscillators and seeded noise: no samples, no recordings.
// The melody is Ghostel's own lobby theme ("Waltz of the Lost Keys", apps/web/src/ui/scores.ts), played with the
// same music-box and celesta recipes as the app's music player (apps/web/src/ui/music.ts).
// Event times come from src/timeline.ts, so every hit lands on the frame it belongs to.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SCORES, frequency, type Bar } from "../../../apps/web/src/ui/scores.ts";
import { seeded } from "../src/three/random.ts";
import { FPS, INTRO, OUTRO, signFlicker } from "../src/timeline.ts";

const SR = 48_000;
const sec = (frame: number) => frame / FPS;

type Wave = "sine" | "triangle" | "saw" | "square";

function wave(type: Wave, phase: number): number {
  const p = phase - Math.floor(phase);
  switch (type) {
    case "sine":
      return Math.sin(2 * Math.PI * p);
    case "triangle":
      return 1 - 4 * Math.abs(p - 0.5);
    case "saw":
      return 2 * p - 1;
    case "square":
      return p < 0.5 ? 1 : -1;
  }
}

/** The app's envelope: exponential rise to `peak` over `attack`, exponential fall to silence over `decay`. */
function envelope(t: number, peak: number, attack: number, decay: number): number {
  const floor = 0.0001;
  if (t < 0) return 0;
  if (t < attack) return floor * (peak / floor) ** (t / attack);
  if (t < attack + decay) return peak * (floor / peak) ** ((t - attack) / decay);
  return 0;
}

class Biquad {
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  constructor(private readonly kind: "lowpass" | "highpass" | "bandpass") {}
  /** RBJ cookbook coefficients. */
  set(freq: number, q: number): this {
    const w = (2 * Math.PI * Math.min(freq, SR * 0.45)) / SR;
    const alpha = Math.sin(w) / (2 * q);
    const cos = Math.cos(w);
    const a0 = 1 + alpha;
    let b0: number;
    let b1: number;
    let b2: number;
    if (this.kind === "lowpass") [b0, b1, b2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
    else if (this.kind === "highpass") [b0, b1, b2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
    else [b0, b1, b2] = [alpha, 0, -alpha];
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
    return this;
  }
  run(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/** A stereo mix with a dry bus and a reverb send. */
class Mix {
  readonly length: number;
  readonly dry: [Float32Array, Float32Array];
  readonly wet: [Float32Array, Float32Array];
  constructor(seconds: number) {
    this.length = Math.round(seconds * SR);
    this.dry = [new Float32Array(this.length), new Float32Array(this.length)];
    this.wet = [new Float32Array(this.length), new Float32Array(this.length)];
  }
  /** Adds sample `v` at index `i`, panned (−1 left … 1 right), with `send` of it into the reverb. */
  add(i: number, v: number, pan = 0, send = 0.3): void {
    if (i < 0 || i >= this.length) return;
    const l = Math.cos(((pan + 1) * Math.PI) / 4);
    const r = Math.sin(((pan + 1) * Math.PI) / 4);
    const [dl, dr] = this.dry;
    const [wl, wr] = this.wet;
    dl[i] = (dl[i] as number) + v * l;
    dr[i] = (dr[i] as number) + v * r;
    wl[i] = (wl[i] as number) + v * l * send;
    wr[i] = (wr[i] as number) + v * r * send;
  }
  /** Runs `fn(t)` for every sample from `start` for `duration` seconds and adds the result. */
  render(start: number, duration: number, fn: (t: number, i: number) => number, pan = 0, send = 0.3): void {
    const i0 = Math.max(0, Math.round(start * SR));
    const i1 = Math.min(this.length, Math.round((start + duration) * SR));
    for (let i = i0; i < i1; i++) this.add(i, fn((i - i0) / SR, i), pan, send);
  }
}

/** Schroeder reverb: four parallel combs into two allpasses, slightly different delays per channel. */
function reverb(input: Float32Array, spread: number, decay = 0.8): Float32Array {
  const scale = SR / 44_100;
  const combs = [1557, 1617, 1491, 1422].map((d) => Math.round((d + spread) * scale));
  const allpasses = [225, 556].map((d) => Math.round((d + spread) * scale));
  const out = new Float32Array(input.length);
  for (const d of combs) {
    const buf = new Float32Array(d);
    let idx = 0;
    let low = 0;
    for (let i = 0; i < input.length; i++) {
      const y = buf[idx] as number;
      low = y * 0.75 + low * 0.25; // damping
      buf[idx] = (input[i] as number) + low * decay;
      out[i] = (out[i] as number) + y / combs.length;
      idx = (idx + 1) % d;
    }
  }
  for (const d of allpasses) {
    const buf = new Float32Array(d);
    let idx = 0;
    for (let i = 0; i < out.length; i++) {
      const b = buf[idx] as number;
      const x = out[i] as number;
      buf[idx] = x + b * 0.5;
      out[i] = b - x * 0.5;
      idx = (idx + 1) % d;
    }
  }
  return out;
}

// ---------- instruments (the recipes from music.ts) ----------

function tone(mix: Mix, t0: number, f: number, type: Wave, peak: number, attack: number, decay: number, pan = 0, send = 0.3, glide?: (t: number) => number): void {
  let phase = 0;
  mix.render(
    t0,
    attack + decay + 0.02,
    (t) => {
      phase += (glide ? glide(t) : f) / SR;
      return wave(type, phase) * envelope(t, peak, attack, decay);
    },
    pan,
    send,
  );
}

function musicBox(mix: Mix, t: number, f: number, gain: number, pan = 0): void {
  tone(mix, t, f, "sine", 0.5 * gain, 0.004, 1.8, pan, 0.45);
  tone(mix, t, f * 2, "sine", 0.16 * gain, 0.003, 0.5, pan, 0.45);
  tone(mix, t, f * 5.4, "sine", 0.05 * gain, 0.002, 0.15, pan, 0.45);
}

function celesta(mix: Mix, t: number, f: number, gain: number, pan = 0): void {
  tone(mix, t, f, "triangle", 0.45 * gain, 0.005, 2.4, pan, 0.55);
  tone(mix, t, f * 4, "sine", 0.12 * gain, 0.003, 0.9, pan, 0.55);
}

/** One bar of the lobby waltz: melody on the lead, bass on beat 1, chord plucks on beats 2 and 3 (as in music.ts). */
function waltzBar(mix: Mix, bar: Bar, t0: number, beat: number, gain: number, lead: "musicbox" | "celesta", stopAt = Infinity, detune: (t: number) => number = () => 1): void {
  let t = t0;
  for (const [note, beats] of bar.melody) {
    if (note !== "-" && t < stopAt) (lead === "musicbox" ? musicBox : celesta)(mix, t, frequency(note) * detune(t), gain, 0.1);
    t += beats * beat;
  }
  const [root, ...upper] = bar.chord.map(frequency);
  if (root === undefined) return;
  if (t0 < stopAt) tone(mix, t0, root * detune(t0), "triangle", 0.5 * gain * 0.6, 0.01, beat * 0.9, -0.15, 0.25);
  for (let b = 1; b < 3; b++) {
    const tb = t0 + b * beat;
    if (tb >= stopAt) continue;
    for (const f of upper) tone(mix, tb, f * 2 * detune(tb), "sine", 0.09 * gain, 0.004, beat * 0.6, -0.25, 0.35);
  }
}

const LOBBY = SCORES.lobby.bars;
const lobbyBar = (n: number) => LOBBY[n - 1] as Bar;

// ---------- sound effects ----------

function wind(mix: Mix, start: number, duration: number, gain: number, seed: number): void {
  const rng = seeded(seed);
  const bp = [new Biquad("bandpass"), new Biquad("bandpass")];
  for (const [ch, pan] of [
    [0, -0.6],
    [1, 0.6],
  ] as const) {
    const f = bp[ch] as Biquad;
    mix.render(
      start,
      duration,
      (t, i) => {
        if (i % 64 === 0 || t === 0) f.set(380 + 260 * Math.sin(t * 0.9 + ch * 2) + 120 * Math.sin(t * 2.3), 1.6);
        const fade = Math.min(1, t / 1.0) * Math.min(1, (duration - t) / 0.6);
        return f.run(rng() * 2 - 1) * gain * fade * (0.7 + 0.3 * Math.sin(t * 1.7 + ch));
      },
      pan,
      0.2,
    );
  }
}

/** A low drone on D with a fifth, swelling with `shape(t)`. */
function drone(mix: Mix, start: number, duration: number, shape: (t: number) => number): void {
  const lp = new Biquad("lowpass").set(420, 0.7);
  let p1 = 0;
  let p2 = 0;
  let p3 = 0;
  mix.render(
    start,
    duration,
    (t) => {
      p1 += frequency("D2") / SR;
      p2 += (frequency("A2") * 1.002) / SR;
      p3 += (frequency("D2") * 0.998) / SR;
      return lp.run(wave("saw", p1) * 0.5 + wave("saw", p2) * 0.3 + wave("sine", p3) * 0.6) * shape(t);
    },
    0,
    0.35,
  );
}

/** A riser: noise swept up through a band-pass, and a sine gliding up an octave and a half. */
function riser(mix: Mix, start: number, duration: number, gain: number, seed: number): void {
  const rng = seeded(seed);
  const bp = new Biquad("bandpass");
  mix.render(
    start,
    duration,
    (t) => {
      const x = t / duration;
      bp.set(400 * 15 ** x, 2.2);
      return bp.run(rng() * 2 - 1) * gain * x ** 2.2 * 1.6;
    },
    0,
    0.4,
  );
  tone(mix, start, 0, "sine", gain * 0.5, duration * 0.98, 0.04, 0, 0.4, (t) => 110 * 2 ** ((t / duration) * 2.6));
}

/** The burst: a sub boom falling in pitch, a noise blast and a click. */
function boom(mix: Mix, at: number, gain: number, seed: number): void {
  tone(mix, at, 0, "sine", gain, 0.004, 1.4, 0, 0.3, (t) => 32 + 110 * Math.exp(-t * 6));
  tone(mix, at, 0, "triangle", gain * 0.35, 0.002, 0.5, 0, 0.3, (t) => 60 + 220 * Math.exp(-t * 14));
  const rng = seeded(seed);
  const lp = new Biquad("lowpass");
  mix.render(
    at,
    1.3,
    (t) => {
      lp.set(200 + 7000 * Math.exp(-t * 5), 0.8);
      return lp.run(rng() * 2 - 1) * gain * 0.9 * envelope(t, 1, 0.002, 1.25);
    },
    0,
    0.6,
  );
}

/** Sparse crackles (shards and embers), each a tiny filtered noise tick at a random pan. */
function crackle(mix: Mix, start: number, duration: number, count: number, gain: number, seed: number): void {
  const rng = seeded(seed);
  for (let k = 0; k < count; k++) {
    // denser at the start, thinning out
    const at = start + duration * rng() ** 1.8;
    const pan = rng() * 2 - 1;
    const hp = new Biquad("highpass").set(1800 + rng() * 3500, 0.9);
    const len = 0.004 + rng() * 0.02;
    const g = gain * (0.3 + rng() * 0.7) * (1 - (at - start) / duration) ** 0.5;
    const noise = seeded(seed * 31 + k);
    mix.render(at, len + 0.01, (t) => hp.run(noise() * 2 - 1) * g * envelope(t, 1, 0.0008, len), pan, 0.4);
  }
}

/** A reversed whoosh: band-passed noise that grows and rises until `end`, then stops dead. */
function reverseWhoosh(mix: Mix, start: number, end: number, gain: number, seed: number): void {
  const rng = seeded(seed);
  const bp = new Biquad("bandpass");
  const duration = end - start;
  mix.render(
    start,
    duration,
    (t) => {
      const x = t / duration;
      bp.set(500 * 8 ** x, 1.4);
      return bp.run(rng() * 2 - 1) * gain * x ** 2 * 2.2 * (1 + 0.3 * Math.sin(t * 40));
    },
    0,
    0.6,
  );
}

/** Neon hum: 100 Hz buzz whose level follows the sign's brightness frame by frame, with a zap on each change. */
function neon(mix: Mix, scene: "intro" | "outro", start: number, end: number, gain: number, seed: number): void {
  const rng = seeded(seed);
  let phase = 0;
  let level = 0;
  const lp = new Biquad("lowpass").set(2400, 0.7);
  mix.render(
    start,
    end - start,
    (t) => {
      const frame = Math.floor((start + t) * FPS);
      const target = signFlicker(scene, frame);
      const prev = signFlicker(scene, frame - 1);
      level += (target - level) * 0.004;
      phase += 100 / SR;
      const buzz = wave("square", phase) * 0.35 + wave("saw", phase * 2) * 0.25 + wave("sine", phase) * 0.5;
      const intoFrame = (start + t) * FPS - frame;
      const zap = target !== prev && intoFrame < 0.25 ? (rng() * 2 - 1) * 0.6 : 0;
      return lp.run(buzz * level * gain + zap * gain);
    },
    0.2,
    0.15,
  );
}

/** Bat wings: band-passed noise beating at about 11 flaps per second, panned across. */
function flutter(mix: Mix, start: number, duration: number, gain: number, panFrom: number, panTo: number, seed: number): void {
  const rng = seeded(seed);
  const bp = new Biquad("bandpass").set(900 + rng() * 900, 1.2);
  const rate = 10 + rng() * 3;
  const steps = 8;
  for (let s = 0; s < steps; s++) {
    const t0 = start + (s * duration) / steps;
    const pan = panFrom + ((panTo - panFrom) * s) / steps;
    mix.render(
      t0,
      duration / steps,
      (t) => {
        const tt = t0 - start + t;
        const flap = Math.max(0, Math.sin(2 * Math.PI * rate * tt)) ** 3;
        const fade = Math.sin(Math.PI * Math.min(1, tt / duration));
        return bp.run(rng() * 2 - 1) * gain * flap * fade;
      },
      pan,
      0.3,
    );
  }
}

/** A soft pad chord (detuned triangles) with a slow swell. */
function pad(mix: Mix, at: number, notes: string[], gain: number, attack: number, decay: number): void {
  notes.forEach((n, i) => {
    tone(mix, at, frequency(n), "triangle", gain, attack, decay, -0.4 + i * 0.4, 0.6);
    tone(mix, at, frequency(n) * 1.004, "sine", gain * 0.6, attack, decay, 0.4 - i * 0.4, 0.6);
  });
}

// ---------- the two cues ----------

function intro(): Mix {
  const total = sec(INTRO.frames);
  const mix = new Mix(total);
  const burst = sec(INTRO.burst);
  const ignite = sec(INTRO.ignite);
  wind(mix, 0, total, 0.09, 1);
  drone(mix, 0, burst, (t) => 0.05 + 0.1 * (t / burst) ** 2);
  drone(mix, ignite, total - ignite, (t) => 0.06 * Math.min(1, t / 0.8));
  // Lobby waltz bars 1–2, a little faster than in the hotel (120 instead of 104 bpm); cut by the burst.
  const beat = 60 / 120;
  waltzBar(mix, lobbyBar(1), 0.2, beat, 0.55, "musicbox", burst);
  waltzBar(mix, lobbyBar(2), 0.2 + 3 * beat, beat, 0.55, "musicbox", burst);
  riser(mix, sec(INTRO.chargeStart), burst - sec(INTRO.chargeStart), 0.4, 2);
  boom(mix, burst, 0.95, 3);
  crackle(mix, burst, 1.3, 180, 0.6, 4);
  reverseWhoosh(mix, sec(INTRO.burstEnd), ignite, 0.3, 5);
  // The sign lights up: shimmer up the D minor chord and a pad underneath.
  ["D5", "F5", "A5", "D6", "F6"].forEach((n, i) => celesta(mix, ignite + i * 0.045, frequency(n), 0.4, -0.6 + i * 0.3));
  pad(mix, ignite, ["D3", "F3", "A3"], 0.07, 0.25, 2.6);
  neon(mix, "intro", ignite, total, 0.035, 6);
  // Bars 15–16 (A → Dm) close the phrase under the tagline.
  const beat2 = 60 / 140;
  const t15 = sec(INTRO.taglineIn) - 0.05;
  waltzBar(mix, lobbyBar(15), t15, beat2, 0.6, "celesta");
  waltzBar(mix, lobbyBar(16), t15 + 3 * beat2, beat2, 0.6, "celesta");
  return mix;
}

function outro(): Mix {
  const total = sec(OUTRO.frames);
  const mix = new Mix(total);
  const burst = sec(OUTRO.burst);
  const flicker = sec(OUTRO.flickerStart);
  wind(mix, 0, total, 0.07, 11);
  drone(mix, 0, burst, (t) => 0.05 * Math.min(1, t / 0.5));
  neon(mix, "outro", 0, burst + 0.05, 0.04, 12);
  // Bars 9–10 of the lobby waltz; once the sign starts failing, the music box sags in pitch like a dying motor.
  const beat = 60 / 120;
  const sag = (t: number) => 1 - 0.05 * Math.max(0, (t - flicker) / (burst - flicker));
  waltzBar(mix, lobbyBar(9), 0.3, beat, 0.55, "musicbox", burst, sag);
  waltzBar(mix, lobbyBar(10), 0.3 + 3 * beat, beat, 0.55, "musicbox", burst, sag);
  riser(mix, flicker + 0.3, burst - flicker - 0.3, 0.3, 13);
  boom(mix, burst, 0.7, 14);
  crackle(mix, burst, sec(OUTRO.embersEnd) - burst, 200, 0.45, 15);
  const flutterRng = seeded(16);
  for (let b = 0; b < 5; b++) {
    const side = b % 2 === 0 ? -1 : 1;
    flutter(mix, burst + 0.05 + b * 0.08, 1.2 + flutterRng() * 0.6, 0.12, side * 0.2, side * 0.95, 17 + b);
  }
  // Bars 15–16 under the credits, then a long D minor chord.
  const beat2 = 60 / 132;
  const t15 = sec(OUTRO.creditsIn) + 0.15;
  waltzBar(mix, lobbyBar(15), t15, beat2, 0.6, "celesta");
  waltzBar(mix, lobbyBar(16), t15 + 3 * beat2, beat2, 0.6, "celesta");
  pad(mix, t15 + 3 * beat2, ["D3", "A3", "D4", "F4"], 0.06, 0.4, 2.6);
  return mix;
}

// ---------- mixdown and WAV ----------

function master(mix: Mix, fadeFrom: number): [Float32Array, Float32Array] {
  const out = [0, 1].map((ch) => {
    const dry = mix.dry[ch] as Float32Array;
    const wet = reverb(mix.wet[ch] as Float32Array, ch * 23);
    const o = new Float32Array(mix.length);
    for (let i = 0; i < mix.length; i++) o[i] = (dry[i] as number) + (wet[i] as number) * 0.9;
    return o;
  }) as [Float32Array, Float32Array];
  // Soft clip, fade with the picture, then normalize the peak to −1 dBFS.
  const i0 = Math.round(fadeFrom * SR);
  let peak = 0;
  for (const o of out) {
    for (let i = 0; i < o.length; i++) {
      let v = Math.tanh((o[i] as number) * 1.1);
      if (i >= i0) v *= Math.cos(((i - i0) / (o.length - i0)) * (Math.PI / 2));
      if (i < 48) v *= i / 48;
      o[i] = v;
      peak = Math.max(peak, Math.abs(v));
    }
  }
  const gain = peak > 0 ? 10 ** (-1 / 20) / peak : 1;
  for (const o of out) for (let i = 0; i < o.length; i++) o[i] = (o[i] as number) * gain;
  return out;
}

function wav([l, r]: [Float32Array, Float32Array]): Buffer {
  const n = l.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(2, 22); // stereo
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, l[i] as number)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, r[i] as number)) * 32767), 46 + i * 4);
  }
  return buf;
}

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "..", "public");
mkdirSync(publicDir, { recursive: true });
for (const [name, make, fadeFrom] of [
  ["intro.wav", intro, sec(INTRO.fadeOut)],
  ["outro.wav", outro, sec(OUTRO.fadeOut)],
] as const) {
  const started = performance.now();
  const data = wav(master(make(), fadeFrom));
  writeFileSync(join(publicDir, name), data);
  console.log(`${name}: ${(data.length / 1024).toFixed(0)} KiB, ${((data.length - 44) / 4 / SR).toFixed(2)} s, ${SR} Hz 16-bit stereo, ${((performance.now() - started) / 1000).toFixed(1)} s to make`);
}
