import { describe, expect, it } from "vitest";
import {
  BOT_ID,
  PAIRS_FACES,
  ROOM_GAMES,
  buildDeck,
  createGameRegistry,
  createPairsEngine,
  type PairsConfig,
  type PairsState,
} from "../src/index";

const CONFIG: PairsConfig = { pairs: 4, introMs: 100, turnMs: 1000, peekMs: 200, podiumMs: 300, botMinMs: 50, botMaxMs: 50, botMemory: 1 };

/** Small deterministic generator so decks and bot picks repeat. */
function seeded(seed = 7): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const engine = createPairsEngine(CONFIG);
const ALICE = { id: "a", name: "Alice" };
const BEN = { id: "b", name: "Ben" };

function started(players = [ALICE, BEN], rng = seeded()): PairsState {
  const s = engine.create({ players, now: 0, rng });
  return engine.advance(s, CONFIG.introMs, rng);
}

/** Indexes of two cards with the same face, and one card with a different face. */
function pairAndOther(s: PairsState): { a: number; b: number; other: number } {
  const a = s.cards.findIndex((c) => c.owner === null);
  const face = s.cards[a]?.face;
  const b = s.cards.findIndex((c, i) => i !== a && c.face === face);
  const other = s.cards.findIndex((c) => c.owner === null && c.face !== face);
  return { a, b, other };
}

describe("Monster Pairs deck", () => {
  it("has two of each chosen monster, from the creator's heads", () => {
    const deck = buildDeck(8, seeded());
    expect(deck).toHaveLength(16);
    const counts = new Map<string, number>();
    for (const c of deck) counts.set(c.face, (counts.get(c.face) ?? 0) + 1);
    expect([...counts.values()].every((n) => n === 2)).toBe(true);
    expect([...counts.keys()].every((f) => PAIRS_FACES.some((p) => p.id === f))).toBe(true);
  });

  it("is a room game in the registry next to Pumpkin Trivia", () => {
    expect(ROOM_GAMES).toContain("monster_pairs");
    const registry = createGameRegistry();
    expect(Object.keys(registry).sort()).toEqual(["monster_pairs", "pumpkin_trivia"]);
    expect(registry.monster_pairs?.id).toBe("monster_pairs");
  });
});

describe("Monster Pairs rules", () => {
  it("starts with an intro, then the first player's turn; a solo player gets Jack O'Bot", () => {
    const solo = engine.create({ players: [ALICE], now: 0, rng: seeded() });
    expect(solo.players.map((p) => p.id)).toEqual(["a", BOT_ID]);
    expect(engine.view(solo, "a", 0).phase).toBe("intro");
    const s = started();
    const v = engine.view(s, "a", CONFIG.introMs);
    expect(v.phase).toBe("play");
    expect(v.current).toBe("a");
    expect(v.cards).toHaveLength(8);
  });

  it("never shows the face of a card that is down", () => {
    const s = started();
    const v = engine.view(s, "a", 200);
    expect(v.cards.every((c) => c.state === "down")).toBe(true);
    expect(JSON.stringify(v)).not.toMatch(/face/);
    const { a } = pairAndOther(s);
    const one = engine.act(s, "a", { turn: s.turn, card: a }, 300) as PairsState;
    const seen = engine.view(one, "b", 300);
    expect(seen.cards.filter((c) => c.state === "up")).toHaveLength(1);
    expect(seen.cards.filter((c) => "face" in c)).toHaveLength(1);
  });

  it("only the current player may flip, with the current turn number, face-down cards only", () => {
    const s = started();
    const { a, b } = pairAndOther(s);
    expect(engine.act(s, "b", { turn: s.turn, card: a }, 200)).toBeNull(); // not Ben's turn
    expect(engine.act(s, "a", { turn: s.turn + 1, card: a }, 200)).toBeNull(); // stale or future turn
    expect(engine.act(s, "a", { turn: s.turn, card: 99 }, 200)).toBeNull(); // out of range
    const one = engine.act(s, "a", { turn: s.turn, card: a }, 200) as PairsState;
    expect(engine.act(one, "a", { turn: s.turn, card: a }, 210)).toBeNull(); // same card twice
    const two = engine.act(one, "a", { turn: s.turn, card: b }, 220) as PairsState;
    expect(engine.act(two, "a", { turn: two.turn, card: a }, 230)).toBeNull(); // matched card
    expect(engine.parseAction({ turn: 1, card: 2, extra: true })).toBeNull();
    expect(engine.parseAction({ turn: 1, card: -1 })).toBeNull();
    expect(engine.parseAction({ turn: 1, card: 2 })).toEqual({ turn: 1, card: 2 });
  });

  it("a match keeps the turn and scores; a mismatch is shown, then the turn passes", () => {
    const s = started();
    const { a, b, other } = pairAndOther(s);
    let x = engine.act(s, "a", { turn: s.turn, card: a }, 200) as PairsState;
    x = engine.act(x, "a", { turn: s.turn, card: b }, 210) as PairsState;
    let v = engine.view(x, "b", 210);
    expect(v.current).toBe("a");
    expect(v.players.find((p) => p.id === "a")?.score).toBe(1);
    expect(v.cards.filter((c) => c.state === "matched")).toHaveLength(2);
    expect(v.lastMatch?.by).toBe("a");

    const rest = pairAndOther(x);
    x = engine.act(x, "a", { turn: x.turn, card: rest.a }, 300) as PairsState;
    const wrong = x.cards.findIndex((c, i) => c.owner === null && i !== rest.a && c.face !== x.cards[rest.a]?.face);
    x = engine.act(x, "a", { turn: x.turn, card: wrong }, 310) as PairsState;
    v = engine.view(x, "b", 320);
    expect(v.peek).toBe(true);
    expect(v.cards.filter((c) => c.state === "up")).toHaveLength(2);
    expect(engine.act(x, "a", { turn: x.turn, card: other }, 330)).toBeNull(); // no flips during the peek
    x = engine.advance(x, 310 + CONFIG.peekMs, seeded());
    v = engine.view(x, "a", 600);
    expect(v.current).toBe("b");
    expect(v.peek).toBe(false);
    expect(v.cards.filter((c) => c.state === "up")).toHaveLength(0);
  });

  it("the turn timer passes the turn, and a player who leaves is skipped but keeps their pairs", () => {
    const carol = { id: "c", name: "Carol" };
    let s = started([ALICE, BEN, carol]);
    s = engine.advance(s, CONFIG.introMs + CONFIG.turnMs, seeded());
    expect(engine.view(s, "a", 0).current).toBe("b");
    s = engine.removePlayer(s, "b");
    s = engine.advance(s, CONFIG.introMs + CONFIG.turnMs + 10, seeded());
    expect(engine.view(s, "a", 0).current).toBe("c");
    expect(engine.presentHumans(s)).toBe(2);
  });

  it("Jack O'Bot plays its turns and a solo game reaches the podium and ends", () => {
    const rng = seeded(3);
    let s = engine.create({ players: [ALICE], now: 0, rng });
    let now = 0;
    for (let step = 0; step < 4000 && !engine.done(s); step++) {
      now += 25;
      s = engine.advance(s, now, rng);
      const v = engine.view(s, "a", now);
      // Alice always flips the first two face-down cards on her turn.
      if (v.phase === "play" && v.current === "a" && !v.peek) {
        const card = v.cards.findIndex((c, i) => c.state === "down" && !s.flipped.includes(i));
        const next = engine.act(s, "a", { turn: v.turn, card }, now);
        if (next) s = next;
      }
      if (v.phase === "podium") {
        expect(v.players.reduce((sum, p) => sum + p.score, 0)).toBe(CONFIG.pairs);
        expect(v.cards.every((c) => c.state === "matched")).toBe(true);
      }
    }
    expect(engine.done(s)).toBe(true);
    expect(s.players.find((p) => p.bot)?.score).toBeGreaterThan(0);
  });
});
