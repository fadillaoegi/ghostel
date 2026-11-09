import type { RoomGame } from "../rooms";
import type { GameEngine } from "./engine";
import { createTriviaEngine, TRIVIA_DEFAULTS, type TriviaConfig, type TriviaView } from "./trivia";

export * from "./engine";
export * from "./trivia";
export { TRIVIA_QUESTIONS, type TriviaSource } from "./trivia-questions";

/** Union of every game's view. Add new games here. */
export type GameView = TriviaView;

// Engines differ in state/action types; the hub only passes values back to the engine that made them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameEngine = GameEngine<any, any, GameView>;

export type GameRegistry = Partial<Record<Exclude<RoomGame, "none">, AnyGameEngine>>;

export function createGameRegistry(options: { trivia?: TriviaConfig } = {}): GameRegistry {
  return { pumpkin_trivia: createTriviaEngine(options.trivia ?? TRIVIA_DEFAULTS) };
}
