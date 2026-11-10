import { describe, expect, it } from "vitest";
import {
  LOBBY_LAYOUT,
  NIGHT_DESK,
  NIGHT_DESK_INPUT_MAX,
  constrainToWorld,
  nightDeskStep,
  nightDeskZone,
  normalizeCommand,
  promptZones,
  startNightDesk,
  type NightDeskContext,
  type NightDeskState,
} from "../src/index";

const CTX: NightDeskContext = {
  guests: ["Boo", "Lady Whisper"],
  doors: [
    { code: "1A", name: "The Ballroom" },
    { code: "1D", name: null },
  ],
};

function play(commands: readonly string[], from: NightDeskState = startNightDesk().state) {
  let state = from;
  const out: string[] = [];
  for (const c of commands) {
    const r = nightDeskStep(state, c, CTX);
    state = r.state;
    out.push(...r.lines);
  }
  return { state, text: out.join("\n") };
}

const WALKTHROUGH = ["N", "TAKE LEDGER", "S", "RING BELL", "E", "N", "SEARCH SHEETS", "S", "OPEN DOOR", "E", "SIGN LEDGER"];

describe("Night Desk story", () => {
  it("boots at the front desk with the intro", () => {
    const start = startNightDesk();
    expect(start.state.room).toBe("desk");
    expect(start.lines.join("\n")).toContain("ONE GUEST NEVER CHECKED OUT.");
    expect(start.lines.join("\n")).toContain("FRONT DESK.");
  });

  it("can be finished with the walkthrough", () => {
    const { state, text } = play(WALKTHROUGH);
    expect(state.done).toBe(true);
    expect(state.room).toBe("room13");
    expect(state.moves).toBe(WALKTHROUGH.length);
    expect(text).toContain("*** CHECKOUT COMPLETE ***");
    expect(text).toContain(`IN ${WALKTHROUGH.length} MOVES`);
  });

  it("hides door 13 until the bell rings, and keeps it locked without the key", () => {
    const before = play(["E", "OPEN DOOR", "E"]);
    expect(before.text).toContain("ONLY WALLPAPER");
    expect(before.text).toContain("OCCUPIED");
    expect(before.state.room).toBe("corridor");

    const noKey = play(["RING BELL", "E", "OPEN DOOR", "E"]);
    expect(noKey.text).toContain("A DOOR MARKED 13 HAS APPEARED");
    expect(noKey.text).toContain("DOOR 13 IS LOCKED");
    expect(noKey.state.doorOpen).toBe(false);
    expect(noKey.state.room).toBe("corridor");
  });

  it("only signs out in room 13 while holding the ledger", () => {
    expect(play(["SIGN LEDGER"]).text).toContain("NOTHING TO SIGN");
    expect(play(["N", "TAKE LEDGER", "SIGN LEDGER"]).text).toContain("NOBODY HERE");
    const noLedger = play(["RING BELL", "E", "N", "SEARCH", "S", "OPEN DOOR", "E", "SIGN LEDGER"]);
    expect(noLedger.state.done).toBe(false);
    expect(noLedger.text).toContain("NOTHING TO SIGN");
  });

  it("meta commands do not count as moves, and unknown words get the classic reply", () => {
    const { state, text } = play(["HELP", "LOOK", "I", "WHO", "ROOMS", "DANCE WILDLY"]);
    expect(state.moves).toBe(0);
    expect(text).toContain("COMMANDS:");
    expect(text).toContain('I DON\'T KNOW THE WORD "DANCE".');
  });

  it("WHO and ROOMS show what the browser already knows", () => {
    expect(play(["WHO"]).text).toBe("GUESTS IN THE LOBBY: 2\n  BOO\n  LADY WHISPER");
    expect(play(["ROOMS"]).text).toBe("ROOM REGISTER:\n  1A  THE BALLROOM\n  1D  VACANT");
    expect(nightDeskStep(startNightDesk().state, "ROOMS", { guests: [], doors: [] }).lines).toEqual(["NO ROOM DOORS ON THIS FLOOR."]);
  });

  it("RESTART clears the screen and starts over; EXIT closes", () => {
    const mid = play(["N", "TAKE LEDGER"]).state;
    const r = nightDeskStep(mid, "restart", CTX);
    expect(r.clear).toBe(true);
    expect(r.state).toEqual(startNightDesk().state);
    expect(nightDeskStep(mid, "exit", CTX).exit).toBe(true);
    expect(nightDeskStep(mid, "cls", CTX).clear).toBe(true);
  });
});

describe("Night Desk input", () => {
  it("normalizes case, spaces, control and bidi characters", () => {
    expect(normalizeCommand("  take \t the   ledger ")).toBe("TAKE THE LEDGER");
    expect(normalizeCommand("ri\u0000ng\u202Ebell")).toBe("RI NG BELL");
    expect(normalizeCommand(42)).toBe("");
    expect(normalizeCommand(undefined)).toBe("");
  });

  it("rejects lines longer than the limit without changing the state", () => {
    const start = startNightDesk().state;
    expect(normalizeCommand("A".repeat(NIGHT_DESK_INPUT_MAX))).toHaveLength(NIGHT_DESK_INPUT_MAX);
    expect(normalizeCommand("A".repeat(NIGHT_DESK_INPUT_MAX + 1))).toBeNull();
    const r = nightDeskStep(start, "N".repeat(NIGHT_DESK_INPUT_MAX + 1), CTX);
    expect(r.state).toBe(start);
    expect(r.lines[0]).toContain("LINE TOO LONG");
  });

  it("ignores empty input", () => {
    const start = startNightDesk().state;
    expect(nightDeskStep(start, "   ", CTX)).toEqual({ state: start, lines: [] });
  });
});

describe("Night Desk in the lobby", () => {
  it("is a lobby obstacle with a walkable terminal prompt in front of it", () => {
    expect(LOBBY_LAYOUT.obstacles.some((o) => o.kind === "box" && o.label === "night-desk")).toBe(true);
    const zone = nightDeskZone();
    expect(promptZones({ kind: "lobby" })).toContainEqual(zone);
    expect(zone.z).toBeGreaterThan(NIGHT_DESK.maxZ);
    expect(constrainToWorld({ x: zone.x, z: zone.z }, LOBBY_LAYOUT)).toEqual({ x: zone.x, z: zone.z });
  });

  it("is on no other floor", () => {
    for (const floor of [2, 3, 4, 5] as const) {
      expect(promptZones({ kind: "floor", floor }).some((z) => z.kind === "terminal")).toBe(false);
    }
  });
});
