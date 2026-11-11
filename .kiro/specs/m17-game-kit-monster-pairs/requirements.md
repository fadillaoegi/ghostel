# Requirements — Milestone 17: the Ghostel Game Kit and Monster Pairs

Written before the code, on 2026-11-10.

Owner request (2026-11-10, Indonesian, summarised): add a Skeleton Crew echo to Ghostel. Kiro proposed four ideas; the owner chose "A": present the existing game system as the Ghostel Game Kit and prove it with a second, very different game, Monster Pairs. This also closes milestone 8 of the original brief ("a second game").

## Why
- Skeleton Crew asks for a lean, flexible foundation shown through two distinct applications. Ghostel's `GameEngine` interface already runs Pumpkin Trivia without game-specific code in the server hub.
- Monster Pairs plays differently from Trivia: turn-based instead of simultaneous, hidden board state instead of hidden answers, memory instead of knowledge. If it runs on the same kit with no hub change, the kit is proven.
- It stays on-theme for Costume Contest: the cards are the monster heads from the character creator.

## User stories
1. As a room owner, I can choose "🃏 Monster Pairs" as a room's activity when I create it.
2. As a guest in such a room, I press "🃏 Play Monster Pairs" and everyone in the room joins. Alone, I play against Jack O'Bot.
3. On my turn I flip two cards. If they match, I keep the pair and go again. If not, everyone sees both cards for a moment, they flip back, and the next player goes.
4. I always see whose turn it is, a turn timer, and everyone's pairs. The game ends when all pairs are found, with a podium.
5. As a judge, I can read `docs/GAME-KIT.md` to see how a game plugs into Ghostel.
6. The house room 1B (Midnight Library) runs Monster Pairs, so a solo visitor finds it without creating a room.

## Acceptance criteria
- `monster_pairs` is a room game in `ROOM_GAMES`. The database check allows it through a new append-only migration. Existing rooms keep their game.
- The rules live in `packages/shared/src/games/pairs.ts` and implement `GameEngine`. The engine is registered in `createGameRegistry`. `apps/server/src/realtime/hub.ts` is not changed by this milestone.
- The server is the authority for the board, turns, timers and scores:
  - A card's face is never sent while it is face down, to anyone.
  - Only the player whose turn it is can flip, at most two cards per turn, and only face-down cards.
  - Actions carry the turn number, so a late or double click from an earlier turn is ignored.
  - Spectators who arrive late watch and cannot act.
  - Malformed actions count as invalid messages, like every other game.
- A turn ends after a mismatch (after a short peek), when the turn timer runs out, or when the player leaves. A player who leaves keeps their pairs.
- Jack O'Bot plays when there is only one human. It remembers some of the cards it has seen, so it is beatable.
- 8 pairs (16 cards) normally. `TRIVIA_FAST=1` (E2E only, already used for Trivia) also selects a short Pairs game with 4 pairs.
- The web panel shows a card grid with a flip animation, the current turn, a timer bar, a scoreboard and the same podium as Trivia. It works on phones (tap) and desktop (click). The final results stay on screen with "Play again".
- Unit tests for the rules, server integration tests for authority and secrecy, and an E2E test that plays a full game against the bot with screenshots.
