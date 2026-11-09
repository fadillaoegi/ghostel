/**
 * Live, synthesized hotel music: one theme per floor, performed by Web Audio instruments
 * from the scores in `scores.ts`. A lookahead scheduler keeps timing tight; themes cross-fade.
 * Browsers only allow audio after a gesture, so a suspended context resumes on the first tap or key.
 */
import { SCORES, frequency, type Bar, type Score, type ThemeId } from "./scores";

const KEY = "ghostel:music";
const LOOKAHEAD_S = 0.3;
const TICK_MS = 50;
const FADE_S = 1.5;
const MASTER = 0.11;

export function musicEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

export function setMusicEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // Private mode: keep the in-memory choice only.
  }
}

/** Short stereo noise burst with exponential decay: a cheap hall reverb. */
function makeImpulse(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  return buffer;
}

interface Voice {
  out: GainNode;
  score: Score;
  bar: number;
  nextBarAt: number;
  lastLeadFreq: number;
  stopped: boolean;
}

export class HotelMusic {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private current: Voice | null = null;
  private fading: Voice[] = [];
  private timer: number | null = null;
  private theme: ThemeId | null = null;
  private unlock: (() => void) | null = null;

  /** Starts (or switches to) a theme. Safe to call repeatedly. */
  play(theme: ThemeId): void {
    if (!this.ctx) this.boot();
    const ctx = this.ctx;
    if (!ctx || this.theme === theme) return;
    this.theme = theme;
    if (this.current) {
      const old = this.current;
      old.out.gain.cancelScheduledValues(ctx.currentTime);
      old.out.gain.setValueAtTime(old.out.gain.value, ctx.currentTime);
      old.out.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_S);
      this.fading.push(old);
      window.setTimeout(() => {
        old.stopped = true;
        old.out.disconnect();
        this.fading = this.fading.filter((v) => v !== old);
      }, FADE_S * 1000 + 200);
    }
    const score = SCORES[theme];
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, ctx.currentTime);
    out.gain.linearRampToValueAtTime(score.volume, ctx.currentTime + FADE_S);
    out.connect(this.master as GainNode);
    out.connect(this.reverb as ConvolverNode);
    this.current = { out, score, bar: 0, nextBarAt: ctx.currentTime + 0.15, lastLeadFreq: 0, stopped: false };
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.unlock?.();
    this.unlock = null;
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.current = null;
    this.fading = [];
    this.theme = null;
  }

  private boot(): void {
    let ctx: AudioContext;
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = MASTER;
    master.connect(ctx.destination);
    const reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(ctx, 2.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    reverb.connect(wet).connect(master);
    this.master = master;
    this.reverb = reverb;
    this.timer = window.setInterval(() => this.schedule(), TICK_MS);

    if (ctx.state === "suspended") {
      const resume = () => {
        void ctx.resume();
        this.unlock?.();
        this.unlock = null;
      };
      window.addEventListener("pointerdown", resume);
      window.addEventListener("keydown", resume);
      this.unlock = () => {
        window.removeEventListener("pointerdown", resume);
        window.removeEventListener("keydown", resume);
      };
    }
  }

  private schedule(): void {
    const ctx = this.ctx;
    const v = this.current;
    if (!ctx || !v || ctx.state !== "running") return;
    // After a long suspension, jump ahead instead of playing a pile of late notes.
    if (v.nextBarAt < ctx.currentTime - 0.5) v.nextBarAt = ctx.currentTime + 0.05;
    const beat = 60 / v.score.bpm;
    while (v.nextBarAt < ctx.currentTime + LOOKAHEAD_S) {
      const bar = v.score.bars[v.bar % v.score.bars.length] as Bar;
      this.playBar(v, bar, v.nextBarAt, beat);
      v.nextBarAt += beat * v.score.beatsPerBar;
      v.bar += 1;
    }
  }

  private playBar(v: Voice, bar: Bar, t0: number, beat: number): void {
    let t = t0;
    for (const [note, beats] of bar.melody) {
      if (note !== "-") this.lead(v, frequency(note), t, beats * beat);
      t += beats * beat;
    }
    const chord = bar.chord.map(frequency);
    const [root, ...upper] = chord;
    if (root === undefined) return;
    const bpb = v.score.beatsPerBar;
    switch (v.score.accompaniment) {
      case "waltz":
        this.bass(v, root, t0, beat * 0.9, 0.5);
        for (let b = 1; b < bpb; b++) for (const f of upper) this.pluck(v, f * 2, t0 + b * beat, beat * 0.6, 0.09);
        break;
      case "minuet":
        this.bass(v, root, t0, beat * 1.6, 0.45);
        this.bass(v, chord[2] ?? root, t0 + 2 * beat, beat * 0.8, 0.3);
        break;
      case "arp": {
        const tones = [root * 2, (chord[1] ?? root) * 2, (chord[2] ?? root) * 2, root * 4];
        const order = [0, 1, 2, 3, 2, 1, 2, 1];
        order.forEach((idx, i) => this.pluck(v, tones[idx] as number, t0 + (i * beat) / 2, beat * 1.2, 0.07));
        this.bass(v, root, t0, beat * bpb, 0.3);
        break;
      }
      case "pad":
        for (const f of chord) this.pad(v, f * 2, t0, beat * bpb);
        this.bass(v, root, t0, beat * bpb, 0.35);
        break;
      case "swing": {
        // Walking bass on every beat, chord stabs on the off-beats (2 and 4).
        const third = (chord[1] ?? root) / 2;
        const fifth = (chord[2] ?? root) / 2;
        const walk = [root, third, fifth, third];
        for (let b = 0; b < bpb; b++) this.bass(v, walk[b % walk.length] as number, t0 + b * beat, beat * 0.85, 0.42);
        for (const b of [1, 3]) for (const f of upper) this.pluck(v, f * 2, t0 + b * beat, beat * 0.35, 0.07);
        break;
      }
    }
  }

  // ---- instruments ----

  private env(t: number, peak: number, attack: number, decay: number): GainNode {
    const g = (this.ctx as AudioContext).createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }

  private osc(type: OscillatorType, f: number, t: number, length: number, into: AudioNode): OscillatorNode {
    const o = (this.ctx as AudioContext).createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.connect(into);
    o.start(t);
    o.stop(t + length + 0.05);
    return o;
  }

  private lead(v: Voice, f: number, t: number, length: number): void {
    switch (v.score.lead) {
      case "musicbox": {
        const g = this.env(t, 0.5, 0.004, 1.8);
        g.connect(v.out);
        this.osc("sine", f, t, 1.9, g);
        const h = this.env(t, 0.16, 0.003, 0.5);
        h.connect(v.out);
        this.osc("sine", f * 2, t, 0.6, h);
        const tine = this.env(t, 0.05, 0.002, 0.15);
        tine.connect(v.out);
        this.osc("sine", f * 5.4, t, 0.2, tine);
        break;
      }
      case "harpsichord": {
        const ctx = this.ctx as AudioContext;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(3200, t);
        filter.frequency.exponentialRampToValueAtTime(700, t + 0.6);
        const g = this.env(t, 0.28, 0.003, Math.min(1.1, length + 0.3));
        filter.connect(g).connect(v.out);
        this.osc("sawtooth", f, t, 1.2, filter);
        this.osc("square", f * 2, t, 0.4, filter);
        break;
      }
      case "celesta": {
        const g = this.env(t, 0.45, 0.005, 2.4);
        g.connect(v.out);
        this.osc("triangle", f, t, 2.5, g);
        const bell = this.env(t, 0.12, 0.003, 0.9);
        bell.connect(v.out);
        this.osc("sine", f * 4, t, 1, bell);
        break;
      }
      case "theremin": {
        const ctx = this.ctx as AudioContext;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.32, t + 0.18);
        g.gain.setValueAtTime(0.32, t + Math.max(0.2, length - 0.3));
        g.gain.exponentialRampToValueAtTime(0.0001, t + length + 0.25);
        g.connect(v.out);
        const o = ctx.createOscillator();
        o.type = "sine";
        // Glide from the previous note, like a real theremin.
        o.frequency.setValueAtTime(v.lastLeadFreq || f, t);
        o.frequency.exponentialRampToValueAtTime(f, t + 0.16);
        const vib = ctx.createOscillator();
        vib.frequency.value = 5.6;
        const depth = ctx.createGain();
        depth.gain.value = f * 0.012;
        vib.connect(depth).connect(o.frequency);
        o.connect(g);
        o.start(t);
        vib.start(t);
        o.stop(t + length + 0.3);
        vib.stop(t + length + 0.3);
        break;
      }
      case "vibraphone": {
        // Two sines with a slow tremolo, like a vibraphone with its motor on.
        const ctx = this.ctx as AudioContext;
        const g = this.env(t, 0.38, 0.004, 1.5);
        const trem = ctx.createGain();
        trem.gain.value = 1;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5.2;
        const depth = ctx.createGain();
        depth.gain.value = 0.35;
        lfo.connect(depth).connect(trem.gain);
        lfo.start(t);
        lfo.stop(t + 1.7);
        g.connect(trem).connect(v.out);
        this.osc("sine", f, t, 1.6, g);
        const h = this.env(t, 0.1, 0.003, 0.4);
        h.connect(v.out);
        this.osc("sine", f * 4, t, 0.5, h);
        break;
      }
    }
    v.lastLeadFreq = f;
  }

  private pluck(v: Voice, f: number, t: number, length: number, peak: number): void {
    const g = this.env(t, peak, 0.004, length);
    g.connect(v.out);
    this.osc("sine", f, t, length + 0.05, g);
  }

  private bass(v: Voice, f: number, t: number, length: number, peak: number): void {
    const g = this.env(t, peak, 0.01, length);
    g.connect(v.out);
    this.osc("triangle", f, t, length + 0.05, g);
  }

  private pad(v: Voice, f: number, t: number, length: number): void {
    const ctx = this.ctx as AudioContext;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.8);
    g.gain.setValueAtTime(0.05, t + length - 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length + 0.6);
    filter.connect(g).connect(v.out);
    for (const detune of [-7, 7]) {
      const o = this.osc("sawtooth", f, t, length + 0.7, filter);
      o.detune.value = detune;
    }
  }
}

/** Which theme fits a scene key ("lobby", "floor:2", "room:<id>"). */
export function themeFor(sceneKey: string): ThemeId {
  if (sceneKey === "floor:2") return "gallery";
  if (sceneKey === "floor:3") return "greenhouse";
  if (sceneKey === "floor:4") return "diner";
  if (sceneKey === "floor:5") return "rooftop";
  if (sceneKey.startsWith("room:")) return "room";
  return "lobby";
}
