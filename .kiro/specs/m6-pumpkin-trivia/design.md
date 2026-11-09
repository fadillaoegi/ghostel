# Design — Milestone 6: Pumpkin Trivia

## Game system (`packages/shared/src/games/`)
```ts
interface GameEngine<State, View> {
  id: RoomGame;
  maxPlayers: number;
  create(input: { players: { id; name }[]; now; rng }): State;
  parseAction(raw: unknown): Action | null;        // zod
  act(state, playerId, action, now): State | null;  // null = rejected
  advance(state, now, rng): State;                  // same object if nothing changed
  removePlayer(state, playerId): State;
  view(state, viewerId, now): View;                 // must hide secrets
  done(state): boolean;
}
```
`GAME_ENGINES: Partial<Record<RoomGame, GameEngine>>` is the registry. The hub only talks to this interface.

## Pumpkin Trivia (`games/trivia.ts`, `games/trivia-questions.ts`)
- Config (overridable for tests): rounds 7, intro 3.5 s, question 15 s, reveal 5 s, podium 12 s, bot delay 2.5–9 s, bot accuracy 0.65.
- `create` picks `rounds` distinct questions with the RNG, shuffles each question's options, and stores the correct index server-side. If fewer than 2 humans play, it adds the bot `bot:jack`.
- Phases: `intro → question(i) → reveal(i) → … → podium → done`.
- Bot plan: at each question start, every bot gets `{ at, choice }`. `advance` applies due bot answers.
- `view` per viewer:
  - always: `phase, round (1-based), rounds, remainingMs, durationMs, players[{ id, name, bot, score, gone }]`
  - question: `question { text, options }`, `answered: id[]`, `myChoice` (viewer's own only)
  - reveal: plus `correct`, `picks { id → choice | null }`, `gained { id → points }`
- Question bank: about 36 original multiple-choice questions (folklore, literature, film, animals, spooky science). Unit tests check uniqueness and option sanity.

## Protocol
- Client → server: `{ t: "game_start" }`, `{ t: "game_action", action: unknown }` (frame-size bounded, validated by the engine).
- Server → client: `{ t: "game", view: GameView | null }` (per-connection view). `welcome` gains `game: GameView | null` so late joiners watch.
- `{ t: "game_denied", message }` for refused starts.

## Server
- `PresenceHub.games: Map<channel, { engine, state }>`; a 200 ms game timer calls `advance` and sends views when the state changes. When `done`, it sends `view: null` and removes the game.
- `leaveChannel` → `engine.removePlayer`. If no present human players remain, the game is dropped.
- Trivia timings come from `Config.trivia` (env `TRIVIA_FAST=1` switches to short test timings and 3 rounds; used by E2E only).

## Web
- `ui/TriviaPanel.tsx`: intro countdown, question with a CSS timer bar (driven by `remainingMs` from the latest view, smoothed locally), 4 answer buttons (🎃 👻 🦇 🕸️ colours), keys 1–4, answered ticks, scoreboard, reveal colours and points pop, podium with medals and confetti, Play again.
- `ui/sfx.ts`: WebAudio oscillators (tick in the last 3 s, correct, wrong, fanfare), mute stored in `localStorage` (UI preference only).
- HUD button "🎃 Play Pumpkin Trivia" in trivia rooms when no game runs.

## Testing
- Unit: engine (creation, unique questions, answer validation, early end, timeout, scoring, bots, ranking, removePlayer, full run, view never leaks `correct` before the reveal), question bank sanity.
- Integration: start rules, bot added when solo, answers and reveal, isolation from the lobby and other rooms, late joiner gets the view, spectator and duplicate answers ignored, question-phase messages contain no `correct` field.
- E2E (`TRIVIA_FAST=1`): solo vs bot to the podium; two humans see the same question and results; phone screenshots.
