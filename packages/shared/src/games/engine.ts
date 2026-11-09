import type { RoomGame } from "../rooms";

export interface GamePlayerInput {
  id: string;
  name: string;
}

/**
 * Every shared game implements this. The server runs engines without game-specific code;
 * all rules, timers and secrets live in the state, and `view` decides what a viewer may see.
 */
export interface GameEngine<State, Action, View> {
  id: Exclude<RoomGame, "none">;
  maxPlayers: number;
  create(input: { players: GamePlayerInput[]; now: number; rng: () => number }): State;
  /** Validates an untrusted action; null when malformed. */
  parseAction(raw: unknown): Action | null;
  /** Applies a player's action; null when it is not allowed right now. */
  act(state: State, playerId: string, action: Action, now: number): State | null;
  /** Moves timers and bots forward. Returns the same object when nothing changed. */
  advance(state: State, now: number, rng: () => number): State;
  /** The player left the room: keep their score, stop waiting for them. */
  removePlayer(state: State, playerId: string): State;
  /** What `viewerId` may see right now. Must never include secrets that are not revealed yet. */
  view(state: State, viewerId: string, now: number): View;
  /** Human players still in the room. */
  presentHumans(state: State): number;
  done(state: State): boolean;
}
