# The Ghostel Game Kit

Ghostel's room games run on one small interface. The server hub only stores each room's game state, calls the engine, and sends every guest the view the engine allows them to see. The hub contains no code for any particular game.

Two very different games run on it:

| | Pumpkin Trivia (M6) | Monster Pairs (M17) |
| --- | --- | --- |
| Play | Everyone answers at the same time | Players take turns |
| Secret | The correct answer, until the reveal | The faces of cards that are face down |
| Timer | One per question | One per turn, plus a short peek after a miss |
| Score | Points for speed | Pairs found |
| Bot | Jack O'Bot answers with 65% accuracy | Jack O'Bot remembers 70% of the cards it sees |
| Rules | `packages/shared/src/games/trivia.ts` | `packages/shared/src/games/pairs.ts` |
| Panel | `apps/web/src/ui/TriviaPanel.tsx` | `apps/web/src/ui/PairsPanel.tsx` |

Monster Pairs was added in M17 without changing `apps/server/src/realtime/hub.ts`.

## The interface
`packages/shared/src/games/engine.ts`:

```ts
interface GameEngine<State, Action, View> {
  id: Exclude<RoomGame, "none">;
  maxPlayers: number;
  create({ players, now, rng }): State;                 // humans in the room; add a bot if you like
  parseAction(raw: unknown): Action | null;            // validate untrusted input (zod)
  act(state, playerId, action, now): State | null;     // null = not allowed right now
  advance(state, now, rng): State;                     // timers and bots; same object when nothing changed
  removePlayer(state, playerId): State;                // the player left the room
  view(state, viewerId, now): View;                    // never include secrets that are not revealed yet
  presentHumans(state): number;                        // 0 ends the game
  done(state): boolean;                                // true removes the game
}
```

What the hub does with it:
- **Start:** `game_start` in a room whose `game` has an engine calls `create` with the room's guests (up to `maxPlayers`).
- **Act:** `game_action` calls `parseAction`. Malformed input counts as an invalid message, and too many close the socket. Then `act`, then `advance` right away. Then every guest in the room gets their own `view`.
- **Tick:** every 200 ms, `advance`. When `done`, the game is removed and guests get `view: null`.
- **Leave:** `removePlayer`. When `presentHumans` is 0, the game is dropped.
- **Isolation:** all game messages go through the room's channel, so nobody outside the room receives them.

## Adding a third game
These are the steps M17 took for Monster Pairs:

1. **Rules:** add `packages/shared/src/games/<game>.ts` that implements `GameEngine`. Keep every secret inside the state, and let `view` decide what each viewer sees. Add unit tests in `packages/shared/test/`.
2. **Register:** in `packages/shared/src/games/index.ts`, add the view to the `GameView` union and the engine to `createGameRegistry`.
3. **Room game id:** add the id to `ROOM_GAMES` in `packages/shared/src/rooms.ts`. Add an append-only migration in `apps/server/src/db/migrate.ts` that widens `rooms_game_check` (see `006_monster_pairs`).
4. **Config (optional):** add timings to `apps/server/src/config.ts`. `TRIVIA_FAST=1` selects short games for E2E.
5. **Panel:** add `apps/web/src/ui/<Game>Panel.tsx`. Reuse `GameParts.tsx` (`useRemaining`, `ranked`, `Podium`). Add a `case` in `GamePanel` and a label in `GAME_START` (`apps/web/src/ui/Lobby.tsx`).
6. **Labels:** add the room form label in `GAME_LABELS` (`RoomDirectory.tsx`) and the host ghost's lines in `roomHost` (`packages/shared/src/npcs.ts`).
7. **Tests:** add server integration tests in `apps/server/test/games.test.ts` (authority and secrecy), and an E2E test in `e2e/`.

TypeScript checks most of this list: the `GameView` union, `Record<RoomGame, …>` labels and the `switch` in `GamePanel` fail to compile until the new game is handled.

## Skeleton

```ts
import { z } from "zod";
import type { GameEngine } from "./engine";

interface State { players: { id: string; name: string; score: number; gone: boolean }[]; phase: "play" | "done"; secret: number }
interface Action { guess: number }
export interface MyView { game: "my_game"; phase: "play" | "podium"; players: { id: string; name: string; bot: boolean; score: number; gone: boolean }[] }

const schema = z.strictObject({ guess: z.number().int().min(0).max(9) });

export function createMyEngine(): GameEngine<State, Action, MyView> {
  return {
    id: "my_game",
    maxPlayers: 8,
    create: ({ players, rng }) => ({ players: players.map((p) => ({ ...p, score: 0, gone: false })), phase: "play", secret: Math.floor(rng() * 10) }),
    parseAction: (raw) => schema.safeParse(raw).data ?? null,
    act: (s, id, a) => (s.phase === "play" && a.guess === s.secret ? { ...s, phase: "done", players: s.players.map((p) => (p.id === id ? { ...p, score: 1 } : p)) } : null),
    advance: (s) => s,
    removePlayer: (s, id) => ({ ...s, players: s.players.map((p) => (p.id === id ? { ...p, gone: true } : p)) }),
    view: (s) => ({ game: "my_game", phase: s.phase === "done" ? "podium" : "play", players: s.players.map((p) => ({ ...p, bot: false })) }), // never s.secret
    presentHumans: (s) => s.players.filter((p) => !p.gone).length,
    done: (s) => s.phase === "done",
  };
}
```

This skeleton is an example for this document and is not in the codebase. `"my_game"` would also need steps 2–6.
