/** Tiny synthesized sound effects (no audio files). The mute preference is a UI setting in localStorage. */

const KEY = "ghostel:sfx-muted";
let ctx: AudioContext | null = null;

export function sfxMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setSfxMuted(muted: boolean): void {
  try {
    localStorage.setItem(KEY, muted ? "1" : "0");
  } catch {
    // Private mode: keep the in-memory default.
  }
}

function audio(): AudioContext | null {
  if (sfxMuted()) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, length: number, type: OscillatorType = "sine", gain = 0.08) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + length + 0.05);
}

export const sfx = {
  tick: () => tone(880, 0, 0.08, "square", 0.03),
  /** A soft key click for the Night Desk terminal. */
  key: () => tone(1700 + Math.random() * 300, 0, 0.03, "square", 0.012),
  pick: () => tone(520, 0, 0.12, "triangle", 0.06),
  correct: () => {
    tone(660, 0, 0.15, "triangle");
    tone(990, 0.12, 0.25, "triangle");
  },
  wrong: () => {
    tone(220, 0, 0.18, "sawtooth", 0.05);
    tone(165, 0.15, 0.3, "sawtooth", 0.05);
  },
  fanfare: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.3, "triangle", 0.07));
  },
};
