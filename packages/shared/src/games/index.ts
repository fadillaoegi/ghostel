import type { RoomGame } from "../rooms";
import type { GameEngine } from "./engine";
import { createPairsEngine, PAIRS_DEFAULTS, type PairsConfig, type PairsView } from "./pairs";
import { createTriviaEngine, TRIVIA_DEFAULTS, type TriviaConfig, type TriviaView } from "./trivia";

export * from "./engine";
export * from "./trivia";
export * from "./pairs";
export { TRIVIA_QUESTIONS, type TriviaSource } from "./trivia-questions";

/** Union of every game's view. Add new games here (see docs/GAME-KIT.md). */
export type GameView = TriviaView | PairsView;

// Engines differ in state/action types; the hub only passes values back to the engine that made them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameEngine = GameEngine<any, any, GameView>;

export type GameRegistry = Partial<Record<Exclude<RoomGame, "none">, AnyGameEngine>>;

/** Every game Ghostel can run. The server hub has no game-specific code: it only calls these engines. */
export function createGameRegistry(options: { trivia?: TriviaConfig; pairs?: PairsConfig } = {}): GameRegistry {
  return {
    pumpkin_trivia: createTriviaEngine(options.trivia ?? TRIVIA_DEFAULTS),
    monster_pairs: createPairsEngine(options.pairs ?? PAIRS_DEFAULTS),
  };
}
