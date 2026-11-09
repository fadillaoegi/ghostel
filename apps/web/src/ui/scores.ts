/**
 * Original tunes written for Ghostel, performed live by `music.ts` (no recordings).
 * A bar has a chord (note names) and a melody of [note | "-", beats] whose beats add up to the meter.
 */

export type ThemeId = "lobby" | "gallery" | "greenhouse" | "diner" | "rooftop" | "room";
export type LeadInstrument = "musicbox" | "harpsichord" | "celesta" | "theremin" | "vibraphone";
export type Accompaniment = "waltz" | "minuet" | "arp" | "pad" | "swing";

export interface Bar {
  chord: readonly string[];
  melody: readonly (readonly [string, number])[];
}

export interface Score {
  title: string;
  bpm: number;
  beatsPerBar: number;
  lead: LeadInstrument;
  accompaniment: Accompaniment;
  /** Relative loudness of this theme (0–1). */
  volume: number;
  bars: readonly Bar[];
}

const CHORDS: Record<string, readonly string[]> = {
  Dm: ["D3", "F3", "A3"],
  Gm: ["G2", "Bb2", "D3"],
  A: ["A2", "C#3", "E3"],
  A7: ["A2", "C#3", "G3"],
  Bb: ["Bb2", "D3", "F3"],
  C: ["C3", "E3", "G3"],
  F: ["F2", "A2", "C3"],
  Am: ["A2", "C3", "E3"],
  E: ["E2", "G#2", "B2"],
  G: ["G2", "B2", "D3"],
  Em: ["E2", "G2", "B2"],
  B: ["B2", "D#3", "F#3"],
  Dm7: ["D2", "F3", "A3", "C3"],
  G7: ["G2", "B2", "D3", "F3"],
  Cmaj7: ["C3", "E3", "G3", "B3"],
};

const bar = (chord: string, ...melody: [string, number][]): Bar => ({ chord: CHORDS[chord] ?? [], melody });

/** "Waltz of the Lost Keys": music-box waltz in D minor for the Grand Lobby. */
const LOBBY: Score = {
  title: "Waltz of the Lost Keys",
  bpm: 104,
  beatsPerBar: 3,
  lead: "musicbox",
  accompaniment: "waltz",
  volume: 1,
  bars: [
    bar("Dm", ["A4", 2], ["D5", 1]),
    bar("Dm", ["C5", 1], ["A4", 1], ["F4", 1]),
    bar("Gm", ["G4", 2], ["Bb4", 1]),
    bar("A", ["A4", 3]),
    bar("Dm", ["F4", 1], ["A4", 1], ["D5", 1]),
    bar("Bb", ["D5", 2], ["C5", 1]),
    bar("Gm", ["Bb4", 1], ["A4", 1], ["G4", 1]),
    bar("A7", ["E4", 1], ["A4", 2]),
    bar("Dm", ["A4", 2], ["D5", 1]),
    bar("Dm", ["F5", 2], ["E5", 1]),
    bar("Gm", ["D5", 1], ["Bb4", 1], ["G4", 1]),
    bar("C", ["C5", 2], ["E4", 1]),
    bar("F", ["A4", 1], ["C5", 1], ["F5", 1]),
    bar("Bb", ["D5", 2], ["Bb4", 1]),
    bar("A", ["C#5", 1], ["E5", 1], ["A4", 1]),
    bar("Dm", ["D5", 3]),
  ],
};

/** "Minuet for Watching Eyes": harpsichord minuet in A minor for the Hall of Portraits. */
const GALLERY: Score = {
  title: "Minuet for Watching Eyes",
  bpm: 116,
  beatsPerBar: 3,
  lead: "harpsichord",
  accompaniment: "minuet",
  volume: 0.85,
  bars: [
    bar("Am", ["E5", 1], ["C5", 1], ["A4", 1]),
    bar("E", ["B4", 2], ["G#4", 1]),
    bar("Am", ["A4", 1], ["C5", 1], ["E5", 1]),
    bar("Dm", ["F5", 2], ["D5", 1]),
    bar("Am", ["E5", 1], ["C5", 1], ["A4", 1]),
    bar("E", ["G#4", 1], ["B4", 1], ["E5", 1]),
    bar("F", ["D5", 1], ["C5", 1], ["B4", 1]),
    bar("Am", ["A4", 3]),
    bar("C", ["G4", 1], ["C5", 1], ["E5", 1]),
    bar("G", ["D5", 2], ["B4", 1]),
    bar("Am", ["C5", 1], ["E5", 1], ["A5", 1]),
    bar("E", ["G#5", 2], ["E5", 1]),
    bar("F", ["A5", 1], ["F5", 1], ["D5", 1]),
    bar("Dm", ["F5", 1], ["D5", 1], ["B4", 1]),
    bar("E", ["G#4", 1], ["B4", 1], ["D5", 1]),
    bar("Am", ["A4", 3]),
  ],
};

/** "Lullaby for Sleeping Pumpkins": celesta over music-box arpeggios in F major for the Greenhouse. */
const GREENHOUSE: Score = {
  title: "Lullaby for Sleeping Pumpkins",
  bpm: 76,
  beatsPerBar: 4,
  lead: "celesta",
  accompaniment: "arp",
  volume: 0.9,
  bars: [
    bar("F", ["C5", 2], ["A4", 2]),
    bar("Dm", ["D5", 2], ["F5", 2]),
    bar("Bb", ["F5", 3], ["D5", 1]),
    bar("C", ["E5", 4]),
    bar("F", ["C5", 2], ["A4", 2]),
    bar("Dm", ["A4", 2], ["D5", 2]),
    bar("Bb", ["D5", 2], ["C5", 1], ["Bb4", 1]),
    bar("C", ["C5", 4]),
    bar("Am", ["E5", 2], ["C5", 2]),
    bar("Bb", ["D5", 2], ["F5", 2]),
    bar("Gm", ["G5", 2], ["F5", 1], ["D5", 1]),
    bar("C", ["E5", 4]),
    bar("F", ["F5", 2], ["C5", 2]),
    bar("Bb", ["D5", 2], ["Bb4", 2]),
    bar("C", ["E5", 2], ["G5", 2]),
    bar("F", ["F5", 4]),
  ],
};

/** "Nocturne for a Full Moon": theremin over a soft pad in E minor for the Rooftop. */
const ROOFTOP: Score = {
  title: "Nocturne for a Full Moon",
  bpm: 60,
  beatsPerBar: 4,
  lead: "theremin",
  accompaniment: "pad",
  volume: 0.8,
  bars: [
    bar("Em", ["B4", 2], ["G4", 2]),
    bar("C", ["E5", 4]),
    bar("Am", ["C5", 2], ["A4", 2]),
    bar("B", ["F#4", 2], ["D#5", 2]),
    bar("Em", ["E5", 4]),
    bar("C", ["G5", 2], ["E5", 2]),
    bar("Am", ["C5", 2], ["E5", 2]),
    bar("B", ["B4", 3], ["-", 1]),
  ],
};

/** "Swing for Hungry Ghouls": vibraphone over a walking bass in D minor for Ghoul's Diner. */
const DINER: Score = {
  title: "Swing for Hungry Ghouls",
  bpm: 132,
  beatsPerBar: 4,
  lead: "vibraphone",
  accompaniment: "swing",
  volume: 0.8,
  bars: [
    bar("Dm7", ["D5", 0.75], ["F5", 0.25], ["A5", 1], ["G5", 0.75], ["F5", 0.25], ["D5", 1]),
    bar("G7", ["B4", 1], ["D5", 0.75], ["F5", 0.25], ["E5", 2]),
    bar("Cmaj7", ["E5", 0.75], ["G5", 0.25], ["B5", 1], ["A5", 1], ["G5", 1]),
    bar("A7", ["C#5", 2], ["-", 1], ["E5", 0.75], ["C#5", 0.25]),
    bar("Dm7", ["D5", 0.75], ["F5", 0.25], ["A5", 1], ["G5", 0.75], ["F5", 0.25], ["D5", 1]),
    bar("G7", ["F5", 1], ["E5", 0.75], ["D5", 0.25], ["B4", 2]),
    bar("A7", ["A4", 0.75], ["C#5", 0.25], ["E5", 1], ["G5", 1], ["E5", 1]),
    bar("Dm7", ["D5", 3], ["-", 1]),
    bar("Gm", ["G4", 0.75], ["Bb4", 0.25], ["D5", 1], ["G5", 2]),
    bar("C", ["E5", 0.75], ["G5", 0.25], ["E5", 1], ["C5", 2]),
    bar("F", ["A4", 1], ["C5", 0.75], ["F5", 0.25], ["A5", 2]),
    bar("Bb", ["F5", 0.75], ["D5", 0.25], ["Bb4", 1], ["D5", 2]),
    bar("Gm", ["Bb4", 1], ["D5", 1], ["G5", 0.75], ["F5", 0.25], ["D5", 1]),
    bar("A7", ["E5", 0.75], ["G5", 0.25], ["E5", 1], ["C#5", 2]),
    bar("Dm7", ["F5", 0.75], ["E5", 0.25], ["D5", 1], ["A4", 1], ["C#5", 1]),
    bar("Dm7", ["D5", 2], ["-", 2]),
  ],
};

export const SCORES: Record<ThemeId, Score> = {
  lobby: LOBBY,
  gallery: GALLERY,
  greenhouse: GREENHOUSE,
  diner: DINER,
  rooftop: ROOFTOP,
  // Rooms get a slower, quieter lobby waltz so conversation and games come first.
  room: { ...LOBBY, title: "Waltz of the Lost Keys (quiet)", bpm: 92, volume: 0.55 },
};

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "A4" → 69, "C#5" → 73, "Bb2" → 46. Throws on anything else. */
export function midi(note: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(note);
  if (!m) throw new Error(`Bad note ${note}`);
  const base = NOTE_INDEX[m[1] as string] as number;
  const accidental = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + base + accidental;
}

export const frequency = (note: string) => 440 * 2 ** ((midi(note) - 69) / 12);
