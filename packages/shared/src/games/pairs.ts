import { z } from "zod";
import type { GameEngine, GamePlayerInput } from "./engine";
import { BOT_ID, BOT_NAME } from "./trivia";

// Monster Pairs (M17): a turn-based memory game on the same GameEngine kit as Pumpkin Trivia.
// The server owns the board; a card's face is only ever sent while it is face up.

export interface PairsConfig {
  pairs: number;
  introMs: number;
  turnMs: number;
  /** How long a mismatched pair stays face up before it flips back. */
  peekMs: number;
  podiumMs: number;
  botMinMs: number;
  botMaxMs: number;
  /** Chance that the bot remembers a card it saw. */
  botMemory: number;
}

export const PAIRS_DEFAULTS: PairsConfig = {
  pairs: 8,
  introMs: 2500,
  turnMs: 15_000,
  peekMs: 1400,
  podiumMs: 12_000,
  botMinMs: 700,
  botMaxMs: 1400,
  botMemory: 0.7,
};

/** Short game for automated browser tests (selected by TRIVIA_FAST=1, like Trivia). */
export const PAIRS_FAST: PairsConfig = {
  pairs: 4,
  introMs: 600,
  turnMs: 12_000,
  peekMs: 700,
  podiumMs: 4000,
  botMinMs: 300,
  botMaxMs: 600,
  botMemory: 0.7,
};

export const PAIRS_MAX_PLAYERS = 4;
/** How long the "match!" highlight lasts in the view. */
export const PAIRS_MATCH_FLASH_MS = 1200;

/** The monster heads from the character creator. */
export const PAIRS_FACES = [
  { id: "pumpkin", emoji: "🎃", name: "Pumpkin" },
  { id: "skull", emoji: "💀", name: "Skull" },
  { id: "cat", emoji: "🐈‍⬛", name: "Black cat" },
  { id: "vampire", emoji: "🧛", name: "Vampire" },
  { id: "werewolf", emoji: "🐺", name: "Werewolf" },
  { id: "zombie", emoji: "🧟", name: "Zombie" },
  { id: "alien", emoji: "👽", name: "Alien" },
  { id: "ghost", emoji: "👻", name: "Ghost" },
] as const;
export type PairsFace = (typeof PAIRS_FACES)[number]["id"];

export type PairsPhase = "intro" | "play" | "podium" | "done";

interface Player {
  id: string;
  name: string;
  bot: boolean;
  score: number;
  gone: boolean;
}

export interface PairsState {
  config: PairsConfig;
  players: Player[];
  cards: { face: PairsFace; owner: string | null }[];
  phase: PairsPhase;
  endsAt: number;
  durationMs: number;
  /** Increases on every hand-over; actions must name it. */
  turn: number;
  /** Index into `players` of whose turn it is. */
  current: number;
  /** Cards flipped this turn (0–2). */
  flipped: number[];
  /** Set while a mismatched pair is shown. */
  peekUntil: number | null;
  lastMatch: { by: string; face: PairsFace; until: number } | null;
  /** When the bot makes its next flip (only on its turn). */
  botAt: number | null;
  /** What the bot remembers: card index → face. */
  memory: Record<number, PairsFace>;
}

export interface PairsAction {
  turn: number;
  card: number;
}

export interface PairsPlayerView {
  id: string;
  name: string;
  bot: boolean;
  /** Pairs found. */
  score: number;
  gone: boolean;
}

export type PairsCardView = { state: "down" } | { state: "up"; face: PairsFace } | { state: "matched"; face: PairsFace; owner: string };

export interface PairsView {
  game: "monster_pairs";
  phase: Exclude<PairsPhase, "done">;
  players: PairsPlayerView[];
  cards: PairsCardView[];
  /** Whose turn it is (play phase). */
  current: string | null;
  turn: number;
  remainingMs: number;
  durationMs: number;
  /** A mismatched pair is being shown. */
  peek: boolean;
  lastMatch: { by: string; face: PairsFace } | null;
}

const actionSchema = z.strictObject({ turn: z.number().int().min(0).max(100_000), card: z.number().int().min(0).max(63) });

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)) % (i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export function buildDeck(pairs: number, rng: () => number): PairsState["cards"] {
  const faces = shuffle(PAIRS_FACES, rng).slice(0, Math.max(1, Math.min(pairs, PAIRS_FACES.length)));
  return shuffle(
    faces.flatMap((f) => [f.id, f.id]),
    rng,
  ).map((face) => ({ face, owner: null }));
}

function botDelay(config: PairsConfig, rng: () => number): number {
  return config.botMinMs + rng() * (config.botMaxMs - config.botMinMs);
}

/** The bot may remember what it just saw. */
function remember(state: PairsState, card: number, rng: () => number): PairsState["memory"] {
  if (!state.players.some((p) => p.bot)) return state.memory;
  const face = state.cards[card]?.face;
  if (face === undefined || rng() >= state.config.botMemory) return state.memory;
  return { ...state.memory, [card]: face };
}

/** Starts the turn of `index` (or the next player still here), with a fresh timer. */
function startTurn(state: PairsState, index: number, now: number, rng: () => number): PairsState {
  const n = state.players.length;
  let current = index % n;
  for (let i = 0; i < n && state.players[current]?.gone; i++) current = (current + 1) % n;
  const bot = state.players[current]?.bot === true;
  return {
    ...state,
    current,
    turn: state.turn + 1,
    flipped: [],
    peekUntil: null,
    endsAt: now + state.config.turnMs,
    durationMs: state.config.turnMs,
    botAt: bot ? now + botDelay(state.config, rng) : null,
  };
}

function allMatched(state: PairsState): boolean {
  return state.cards.every((c) => c.owner !== null);
}

function flip(state: PairsState, playerId: string, card: number, now: number, rng: () => number): PairsState {
  const memory = remember(state, card, rng);
  const flipped = [...state.flipped, card];
  if (flipped.length < 2) {
    return { ...state, flipped, memory, botAt: state.botAt === null ? null : now + botDelay(state.config, rng) };
  }
  const [a, b] = flipped as [number, number];
  const first = state.cards[a];
  const second = state.cards[b];
  if (first && second && first.face === second.face) {
    const cards = state.cards.map((c, i) => (i === a || i === b ? { ...c, owner: playerId } : c));
    const players = state.players.map((p) => (p.id === playerId ? { ...p, score: p.score + 1 } : p));
    const forgotten = { ...memory };
    delete forgotten[a];
    delete forgotten[b];
    const matched: PairsState = { ...state, cards, players, memory: forgotten, lastMatch: { by: playerId, face: first.face, until: now + PAIRS_MATCH_FLASH_MS } };
    if (allMatched(matched)) {
      return { ...matched, flipped: [], phase: "podium", endsAt: now + state.config.podiumMs, durationMs: state.config.podiumMs, botAt: null };
    }
    // A match: same player goes again with a fresh timer.
    return {
      ...matched,
      flipped: [],
      endsAt: now + state.config.turnMs,
      durationMs: state.config.turnMs,
      botAt: state.botAt === null ? null : now + botDelay(state.config, rng),
    };
  }
  return { ...state, flipped, memory, peekUntil: now + state.config.peekMs, botAt: null };
}

/** The bot's next card: a remembered pair, the remembered match of its first card, or an unknown one. */
export function botPick(state: PairsState, rng: () => number): number | null {
  const down = state.cards.flatMap((c, i) => (c.owner === null && !state.flipped.includes(i) ? [i] : []));
  if (down.length === 0) return null;
  const known = down.filter((i) => state.memory[i] !== undefined);
  const first = state.flipped[0];
  if (first !== undefined) {
    const face = state.cards[first]?.face;
    const match = known.find((i) => state.memory[i] === face);
    if (match !== undefined) return match;
  } else {
    for (const i of known) {
      const twin = known.find((j) => j !== i && state.memory[j] === state.memory[i]);
      if (twin !== undefined) return i;
    }
  }
  const unknown = down.filter((i) => state.memory[i] === undefined);
  const pool = unknown.length > 0 ? unknown : down;
  return pool[Math.floor(rng() * pool.length) % pool.length] ?? null;
}

export function createPairsEngine(config: PairsConfig = PAIRS_DEFAULTS) {
  const engine: GameEngine<PairsState, PairsAction, PairsView> = {
    id: "monster_pairs",
    maxPlayers: PAIRS_MAX_PLAYERS,

    create({ players, now, rng }: { players: GamePlayerInput[]; now: number; rng: () => number }): PairsState {
      const humans: Player[] = players.slice(0, PAIRS_MAX_PLAYERS).map((p) => ({ ...p, bot: false, score: 0, gone: false }));
      const all = humans.length < 2 ? [...humans, { id: BOT_ID, name: BOT_NAME, bot: true, score: 0, gone: false }] : humans;
      return {
        config,
        players: all,
        cards: buildDeck(config.pairs, rng),
        phase: "intro",
        endsAt: now + config.introMs,
        durationMs: config.introMs,
        turn: 0,
        current: 0,
        flipped: [],
        peekUntil: null,
        lastMatch: null,
        botAt: null,
        memory: {},
      };
    },

    parseAction(raw: unknown): PairsAction | null {
      const parsed = actionSchema.safeParse(raw);
      return parsed.success ? parsed.data : null;
    },

    act(state, playerId, action, now) {
      if (state.phase !== "play" || state.peekUntil !== null || action.turn !== state.turn) return null;
      const player = state.players[state.current];
      if (!player || player.id !== playerId || player.bot || player.gone) return null;
      const card = state.cards[action.card];
      if (!card || card.owner !== null || state.flipped.includes(action.card) || state.flipped.length >= 2) return null;
      // `act` gets no rng from the kit; the bot's memory chance uses Math.random (tests pin it with botMemory 0 or 1).
      return flip(state, playerId, action.card, now, Math.random);
    },

    advance(state, now, rng) {
      switch (state.phase) {
        case "intro":
          return now >= state.endsAt ? startTurn({ ...state, phase: "play" }, 0, now, rng) : state;
        case "play": {
          let next = state;
          if (next.lastMatch && now >= next.lastMatch.until) next = { ...next, lastMatch: null };
          // The current player left: hand over right away.
          if (next.players[next.current]?.gone && next.players.some((p) => !p.gone)) return startTurn(next, next.current + 1, now, rng);
          if (next.peekUntil !== null) {
            return now >= next.peekUntil ? startTurn(next, next.current + 1, now, rng) : next;
          }
          if (now >= next.endsAt) return startTurn(next, next.current + 1, now, rng);
          const player = next.players[next.current];
          if (player?.bot && next.botAt !== null && now >= next.botAt) {
            const card = botPick(next, rng);
            if (card !== null) return flip(next, player.id, card, now, rng);
          }
          return next;
        }
        case "podium":
          return now >= state.endsAt ? { ...state, phase: "done" } : state;
        case "done":
          return state;
      }
    },

    removePlayer(state, playerId) {
      if (!state.players.some((p) => p.id === playerId && !p.gone)) return state;
      // If it was their turn, the next `advance` hands over (it knows the time).
      return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, gone: true } : p)) };
    },

    view(state, _viewerId, now): PairsView {
      const phase = state.phase === "done" ? "podium" : state.phase;
      const cards: PairsCardView[] = state.cards.map((c, i) => {
        if (c.owner !== null) return { state: "matched", face: c.face, owner: c.owner };
        if (state.flipped.includes(i)) return { state: "up", face: c.face };
        return { state: "down" };
      });
      return {
        game: "monster_pairs",
        phase,
        players: state.players.map((p) => ({ id: p.id, name: p.name, bot: p.bot, score: p.score, gone: p.gone })),
        cards,
        current: phase === "play" ? (state.players[state.current]?.id ?? null) : null,
        turn: state.turn,
        remainingMs: Math.max(0, (state.peekUntil ?? state.endsAt) - now),
        durationMs: state.peekUntil !== null ? state.config.peekMs : state.durationMs,
        peek: state.peekUntil !== null,
        lastMatch: state.lastMatch && now < state.lastMatch.until ? { by: state.lastMatch.by, face: state.lastMatch.face } : null,
      };
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
