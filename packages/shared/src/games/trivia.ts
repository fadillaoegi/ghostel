import { z } from "zod";
import type { GameEngine, GamePlayerInput } from "./engine";
import { TRIVIA_QUESTIONS, type TriviaSource } from "./trivia-questions";

export interface TriviaConfig {
  rounds: number;
  introMs: number;
  questionMs: number;
  revealMs: number;
  podiumMs: number;
  botMinMs: number;
  botMaxMs: number;
  botAccuracy: number;
}

export const TRIVIA_DEFAULTS: TriviaConfig = {
  rounds: 7,
  introMs: 3500,
  questionMs: 15_000,
  revealMs: 5000,
  podiumMs: 12_000,
  botMinMs: 2500,
  botMaxMs: 9000,
  botAccuracy: 0.65,
};

/** Short timings for automated browser tests. */
export const TRIVIA_FAST: TriviaConfig = {
  rounds: 3,
  introMs: 800,
  // Long enough that a slow, busy test machine still answers inside the window; answering early ends it anyway.
  questionMs: 12_000,
  revealMs: 1500,
  podiumMs: 4000,
  botMinMs: 600,
  botMaxMs: 1500,
  botAccuracy: 0.65,
};

export const TRIVIA_MAX_PLAYERS = 8;
export const BOT_ID = "bot:jack";
export const BOT_NAME = "Jack O'Bot";
export const MAX_POINTS = 1000;

export type TriviaPhase = "intro" | "question" | "reveal" | "podium" | "done";

interface Question {
  text: string;
  options: string[];
  correct: number;
}

interface Player {
  id: string;
  name: string;
  bot: boolean;
  score: number;
  gone: boolean;
}

export interface TriviaState {
  config: TriviaConfig;
  players: Player[];
  questions: Question[];
  /** 0-based index of the current question. */
  round: number;
  phase: TriviaPhase;
  endsAt: number;
  durationMs: number;
  answers: Record<string, { choice: number; at: number }>;
  gained: Record<string, number>;
  botPlan: { id: string; at: number; choice: number }[];
}

export interface TriviaAction {
  round: number;
  choice: number;
}

export interface TriviaPlayerView {
  id: string;
  name: string;
  bot: boolean;
  score: number;
  gone: boolean;
}

export interface TriviaView {
  game: "pumpkin_trivia";
  phase: Exclude<TriviaPhase, "done">;
  /** 1-based. */
  round: number;
  rounds: number;
  remainingMs: number;
  durationMs: number;
  players: TriviaPlayerView[];
  question?: { text: string; options: string[] };
  /** Who has answered (not what). Question phase only. */
  answered?: string[];
  /** The viewer's own pick during the question. */
  myChoice?: number | null;
  /** Revealed only after the question closes. */
  reveal?: { correct: number; picks: Record<string, number | null>; gained: Record<string, number> };
}

const actionSchema = z.strictObject({ round: z.number().int().min(0).max(99), choice: z.number().int().min(0).max(3) });

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)) % (i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export function buildQuestions(bank: readonly TriviaSource[], count: number, rng: () => number): Question[] {
  return shuffle(bank, rng)
    .slice(0, count)
    .map((q) => {
      const options = shuffle([q.correct, ...q.wrong], rng);
      return { text: q.text, options, correct: options.indexOf(q.correct) };
    });
}

/** Points for a correct answer given at `at` while the question closes at `endsAt`. */
export function pointsFor(correct: boolean, at: number, endsAt: number, questionMs: number): number {
  if (!correct) return 0;
  const left = Math.max(0, Math.min(questionMs, endsAt - at));
  return 500 + Math.round((500 * left) / questionMs);
}

function startQuestion(state: TriviaState, round: number, now: number, rng: () => number): TriviaState {
  const q = state.questions[round] as Question;
  const { botMinMs, botMaxMs, botAccuracy, questionMs } = state.config;
  const botPlan = state.players
    .filter((p) => p.bot)
    .map((p) => {
      const delay = Math.min(questionMs - 300, botMinMs + rng() * (botMaxMs - botMinMs));
      const wrong = [0, 1, 2, 3].filter((i) => i !== q.correct);
      const choice = rng() < botAccuracy ? q.correct : (wrong[Math.floor(rng() * wrong.length) % wrong.length] as number);
      return { id: p.id, at: now + delay, choice };
    });
  return { ...state, phase: "question", round, endsAt: now + questionMs, durationMs: questionMs, answers: {}, gained: {}, botPlan };
}

function closeQuestion(state: TriviaState, now: number): TriviaState {
  const q = state.questions[state.round] as Question;
  const gained: Record<string, number> = {};
  const players = state.players.map((p) => {
    const a = state.answers[p.id];
    const points = a ? pointsFor(a.choice === q.correct, a.at, state.endsAt, state.config.questionMs) : 0;
    gained[p.id] = points;
    return { ...p, score: p.score + points };
  });
  return { ...state, players, gained, phase: "reveal", endsAt: now + state.config.revealMs, durationMs: state.config.revealMs, botPlan: [] };
}

function everyoneAnswered(state: TriviaState): boolean {
  return state.players.every((p) => p.gone || state.answers[p.id] !== undefined);
}

export function createTriviaEngine(config: TriviaConfig = TRIVIA_DEFAULTS, bank: readonly TriviaSource[] = TRIVIA_QUESTIONS) {
  const engine: GameEngine<TriviaState, TriviaAction, TriviaView> = {
    id: "pumpkin_trivia",
    maxPlayers: TRIVIA_MAX_PLAYERS,

    create({ players, now, rng }: { players: GamePlayerInput[]; now: number; rng: () => number }): TriviaState {
      const humans: Player[] = players.slice(0, TRIVIA_MAX_PLAYERS).map((p) => ({ ...p, bot: false, score: 0, gone: false }));
      const all = humans.length < 2 ? [...humans, { id: BOT_ID, name: BOT_NAME, bot: true, score: 0, gone: false }] : humans;
      return {
        config,
        players: all,
        questions: buildQuestions(bank, Math.min(config.rounds, bank.length), rng),
        round: 0,
        phase: "intro",
        endsAt: now + config.introMs,
        durationMs: config.introMs,
        answers: {},
        gained: {},
        botPlan: [],
      };
    },

    parseAction(raw: unknown): TriviaAction | null {
      const parsed = actionSchema.safeParse(raw);
      return parsed.success ? parsed.data : null;
    },

    act(state, playerId, action, now) {
      if (state.phase !== "question" || action.round !== state.round || now >= state.endsAt) return null;
      const player = state.players.find((p) => p.id === playerId);
      if (!player || player.bot || player.gone || state.answers[playerId]) return null;
      if (action.choice >= (state.questions[state.round] as Question).options.length) return null;
      return { ...state, answers: { ...state.answers, [playerId]: { choice: action.choice, at: now } } };
    },

    advance(state, now, rng) {
      switch (state.phase) {
        case "intro":
          return now >= state.endsAt ? startQuestion(state, 0, now, rng) : state;
        case "question": {
          let next = state;
          const due = state.botPlan.filter((b) => b.at <= now && !state.answers[b.id]);
          if (due.length > 0) {
            const answers = { ...state.answers };
            for (const b of due) answers[b.id] = { choice: b.choice, at: b.at };
            next = { ...state, answers };
          }
          if (now >= next.endsAt || everyoneAnswered(next)) return closeQuestion(next, now);
          return next;
        }
        case "reveal":
          if (now < state.endsAt) return state;
          if (state.round + 1 < state.questions.length) return startQuestion(state, state.round + 1, now, rng);
          return { ...state, phase: "podium", endsAt: now + state.config.podiumMs, durationMs: state.config.podiumMs };
        case "podium":
          return now >= state.endsAt ? { ...state, phase: "done" } : state;
        case "done":
          return state;
      }
    },

    removePlayer(state, playerId) {
      if (!state.players.some((p) => p.id === playerId && !p.gone)) return state;
      return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, gone: true } : p)) };
    },

    view(state, viewerId, now): TriviaView {
      const phase = state.phase === "done" ? "podium" : state.phase;
      const q = state.questions[state.round] as Question;
      const base: TriviaView = {
        game: "pumpkin_trivia",
        phase,
        round: state.round + 1,
        rounds: state.questions.length,
        remainingMs: Math.max(0, state.endsAt - now),
        durationMs: state.durationMs,
        players: state.players.map((p) => ({ id: p.id, name: p.name, bot: p.bot, score: p.score, gone: p.gone })),
      };
      if (phase === "question") {
        return {
          ...base,
          question: { text: q.text, options: [...q.options] },
          answered: Object.keys(state.answers),
          myChoice: state.answers[viewerId]?.choice ?? null,
        };
      }
      if (phase === "reveal") {
        const picks: Record<string, number | null> = {};
        for (const p of state.players) picks[p.id] = state.answers[p.id]?.choice ?? null;
        return { ...base, question: { text: q.text, options: [...q.options] }, reveal: { correct: q.correct, picks, gained: { ...state.gained } } };
      }
      return base;
    },

    presentHumans(state) {
      return state.players.filter((p) => !p.bot && !p.gone).length;
    },

    done(state) {
      return state.phase === "done";
    },
  };
  return engine;
}
