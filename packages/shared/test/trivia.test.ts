import { describe, expect, it } from "vitest";
import {
  BOT_ID,
  TRIVIA_DEFAULTS,
  TRIVIA_QUESTIONS,
  buildQuestions,
  createTriviaEngine,
  parseClientMessage,
  pointsFor,
  type TriviaState,
} from "../src/index";

function seeded(seed = 7) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const cfg = { ...TRIVIA_DEFAULTS };
const engine = createTriviaEngine(cfg);
const two = [
  { id: "a", name: "Alice" },
  { id: "b", name: "Bob" },
];

function toQuestion(state: TriviaState, now: number, rng = seeded()): { state: TriviaState; now: number } {
  const t = now + cfg.introMs;
  return { state: engine.advance(state, t, rng), now: t };
}

describe("question bank", () => {
  it("has unique questions with three distinct wrong options", () => {
    expect(TRIVIA_QUESTIONS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(TRIVIA_QUESTIONS.map((q) => q.text)).size).toBe(TRIVIA_QUESTIONS.length);
    for (const q of TRIVIA_QUESTIONS) {
      const options = [q.correct, ...q.wrong];
      expect(new Set(options.map((o) => o.toLowerCase())).size).toBe(4);
      expect(q.text.length).toBeLessThanOrEqual(120);
      for (const o of options) expect(o.length).toBeLessThanOrEqual(28);
    }
  });

  it("buildQuestions picks distinct questions and tracks the shuffled correct index", () => {
    const qs = buildQuestions(TRIVIA_QUESTIONS, 7, seeded(3));
    expect(new Set(qs.map((q) => q.text)).size).toBe(7);
    for (const q of qs) {
      const source = TRIVIA_QUESTIONS.find((s) => s.text === q.text);
      expect(q.options[q.correct]).toBe(source?.correct);
    }
  });
});

describe("pumpkin trivia engine", () => {
  it("adds a bot for a solo player, not for two", () => {
    const solo = engine.create({ players: [{ id: "a", name: "Alice" }], now: 0, rng: seeded() });
    expect(solo.players.map((p) => p.id)).toEqual(["a", BOT_ID]);
    expect(engine.create({ players: two, now: 0, rng: seeded() }).players.map((p) => p.bot)).toEqual([false, false]);
  });

  it("starts with an intro, then a 15 s question", () => {
    const s0 = engine.create({ players: two, now: 1000, rng: seeded() });
    expect(engine.view(s0, "a", 1000)).toMatchObject({ phase: "intro", round: 1, rounds: 7, remainingMs: cfg.introMs });
    const { state } = toQuestion(s0, 1000);
    expect(state.phase).toBe("question");
    expect(state.endsAt - (1000 + cfg.introMs)).toBe(15_000);
  });

  it("never reveals the correct answer during a question", () => {
    const { state, now } = toQuestion(engine.create({ players: two, now: 0, rng: seeded() }), 0);
    const v = engine.view(state, "a", now);
    expect(v.reveal).toBeUndefined();
    expect(JSON.stringify(v)).not.toContain("correct");
    expect(v.question?.options).toHaveLength(4);
  });

  it("accepts one answer per player and round, and shows only your own pick", () => {
    let { state, now } = toQuestion(engine.create({ players: two, now: 0, rng: seeded() }), 0);
    const a1 = engine.act(state, "a", { round: 0, choice: 2 }, now + 1000);
    expect(a1).not.toBeNull();
    state = a1 as TriviaState;
    expect(engine.act(state, "a", { round: 0, choice: 1 }, now + 2000)).toBeNull(); // no changing your mind
    expect(engine.act(state, "b", { round: 1, choice: 1 }, now + 2000)).toBeNull(); // wrong round
    expect(engine.act(state, "zed", { round: 0, choice: 1 }, now + 2000)).toBeNull(); // spectator
    expect(engine.act(state, "b", { round: 0, choice: 1 }, state.endsAt)).toBeNull(); // too late
    expect(engine.view(state, "a", now).myChoice).toBe(2);
    expect(engine.view(state, "b", now).myChoice).toBeNull();
    expect(engine.view(state, "b", now).answered).toEqual(["a"]);
  });

  it("closes the question early when everyone answered and scores speed", () => {
    let { state, now } = toQuestion(engine.create({ players: two, now: 0, rng: seeded() }), 0);
    const correct = state.questions[0]?.correct as number;
    state = engine.act(state, "a", { round: 0, choice: correct }, now) as TriviaState; // instant: full bonus
    state = engine.act(state, "b", { round: 0, choice: (correct + 1) % 4 }, now + 3000) as TriviaState;
    state = engine.advance(state, now + 3000, seeded());
    expect(state.phase).toBe("reveal");
    const v = engine.view(state, "b", now + 3000);
    expect(v.reveal?.correct).toBe(correct);
    expect(v.reveal?.gained).toEqual({ a: 1000, b: 0 });
    expect(v.reveal?.picks).toEqual({ a: correct, b: (correct + 1) % 4 });
    expect(v.players.find((p) => p.id === "a")?.score).toBe(1000);
  });

  it("times out with missing answers scoring zero", () => {
    const { state, now } = toQuestion(engine.create({ players: two, now: 0, rng: seeded() }), 0);
    const closed = engine.advance(state, now + 15_000, seeded());
    expect(closed.phase).toBe("reveal");
    expect(engine.view(closed, "a", now + 15_000).reveal?.picks).toEqual({ a: null, b: null });
  });

  it("speed bonus is proportional to time left", () => {
    expect(pointsFor(true, 0, 15_000, 15_000)).toBe(1000);
    expect(pointsFor(true, 7500, 15_000, 15_000)).toBe(750);
    expect(pointsFor(true, 15_000, 15_000, 15_000)).toBe(500);
    expect(pointsFor(false, 0, 15_000, 15_000)).toBe(0);
  });

  it("bots answer inside the window and the round waits only for present players", () => {
    let { state, now } = toQuestion(engine.create({ players: [{ id: "a", name: "Alice" }], now: 0, rng: seeded(11) }), 0, seeded(11));
    const plan = state.botPlan[0];
    expect(plan?.at).toBeGreaterThanOrEqual(now + cfg.botMinMs);
    expect(plan?.at).toBeLessThanOrEqual(now + cfg.botMaxMs);
    state = engine.removePlayer(state, "a");
    state = engine.advance(state, (plan?.at ?? 0) + 1, seeded());
    // Alice left, the bot answered: nobody left to wait for.
    expect(state.phase).toBe("reveal");
    expect(engine.presentHumans(state)).toBe(0);
  });

  it("bot accuracy is roughly 65% over many questions", () => {
    let right = 0;
    const n = 400;
    for (let i = 0; i < n; i++) {
      const { state } = toQuestion(engine.create({ players: [{ id: "a", name: "A" }], now: 0, rng: seeded(i + 1) }), 0, seeded(i + 101));
      if (state.botPlan[0]?.choice === state.questions[0]?.correct) right++;
    }
    expect(right / n).toBeGreaterThan(0.55);
    expect(right / n).toBeLessThan(0.75);
  });

  it("runs a full game to the podium and then done", () => {
    const rng = seeded(5);
    let state = engine.create({ players: two, now: 0, rng });
    let now = 0;
    const seen: string[] = [];
    for (let i = 0; i < 200 && !engine.done(state); i++) {
      now += 1000;
      state = engine.advance(state, now, rng);
      if (state.phase === "question" && !state.answers["a"]) {
        state = engine.act(state, "a", { round: state.round, choice: state.questions[state.round]?.correct ?? 0 }, now) ?? state;
      }
      if (seen.at(-1) !== state.phase) seen.push(state.phase);
    }
    expect(seen.slice(0, 2)).toEqual(["intro", "question"]);
    expect(seen.slice(-2)).toEqual(["podium", "done"]);
    expect(seen.filter((p) => p === "question")).toHaveLength(7);
    const a = state.players.find((p) => p.id === "a");
    expect(a?.score).toBeGreaterThanOrEqual(7 * 500);
  });

  it("validates actions and the wire message", () => {
    expect(engine.parseAction({ round: 0, choice: 3 })).toEqual({ round: 0, choice: 3 });
    expect(engine.parseAction({ round: 0, choice: 4 })).toBeNull();
    expect(engine.parseAction({ round: 0, choice: 1, cheat: true })).toBeNull();
    expect(engine.parseAction("A")).toBeNull();
    expect(parseClientMessage('{"t":"game_start"}')).toEqual({ ok: true, msg: { t: "game_start" } });
    expect(parseClientMessage('{"t":"game_action","action":{"round":0,"choice":1}}')).toMatchObject({ ok: true });
  });
});
