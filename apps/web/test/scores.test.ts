import { describe, expect, it } from "vitest";
import { SCORES, frequency, midi, type ThemeId } from "../src/ui/scores";
import { themeFor } from "../src/ui/music";

describe("hotel music scores", () => {
  const themes = Object.keys(SCORES) as ThemeId[];

  it("defines a theme for the lobby, every upper floor and rooms", () => {
    expect([...themes].sort()).toEqual(["diner", "gallery", "greenhouse", "lobby", "rooftop", "room"]);
    expect(themeFor("lobby")).toBe("lobby");
    expect(themeFor("floor:2")).toBe("gallery");
    expect(themeFor("floor:3")).toBe("greenhouse");
    expect(themeFor("floor:4")).toBe("diner");
    expect(themeFor("floor:5")).toBe("rooftop");
    expect(themeFor("room:abc")).toBe("room");
  });

  it.each(themes)("every bar of %s fills its meter exactly and uses real notes", (id) => {
    const score = SCORES[id];
    expect(score.bars.length).toBeGreaterThanOrEqual(8);
    expect(score.bpm).toBeGreaterThan(40);
    for (const [i, bar] of score.bars.entries()) {
      const beats = bar.melody.reduce((sum, [, b]) => sum + b, 0);
      expect(beats, `${id} bar ${i + 1}`).toBe(score.beatsPerBar);
      expect(bar.chord.length, `${id} bar ${i + 1} chord`).toBeGreaterThanOrEqual(3);
      for (const [note] of bar.melody) if (note !== "-") expect(midi(note)).toBeGreaterThanOrEqual(55);
      for (const note of bar.chord) expect(midi(note)).toBeLessThan(60);
    }
  });

  it("converts note names to MIDI and frequency", () => {
    expect(midi("A4")).toBe(69);
    expect(midi("C#5")).toBe(73);
    expect(midi("Bb2")).toBe(46);
    expect(frequency("A4")).toBeCloseTo(440);
    expect(() => midi("H2")).toThrow();
  });
});
