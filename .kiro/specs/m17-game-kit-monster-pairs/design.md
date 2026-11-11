# Design — M17

## The kit (what already exists)
- `GameEngine<State, Action, View>` in `packages/shared/src/games/engine.ts` has these functions: `create`, `parseAction`, `act`, `advance`, `removePlayer`, `view(viewerId)`, `presentHumans` and `done`.
- The hub (`apps/server/src/realtime/hub.ts`) only stores opaque state per room channel and calls those functions.
  - It handles start, actions (with "advance right away"), a 200 ms timer, a per-viewer `view` and cleanup when the last human leaves.
  - Secrets stay safe because `view` decides what each viewer may see.
- To add a game you touch:
  1. The engine file.
  2. `games/index.ts`: the registry and the `GameView` union.
  3. `ROOM_GAMES` and a migration.
  4. A web panel.
  5. Labels: the room form, the start button and the host NPC lines.

  `docs/GAME-KIT.md` lists these steps with a code skeleton.

## Monster Pairs rules (`packages/shared/src/games/pairs.ts`)
- **Faces:** `PAIRS_FACES` (id, emoji, name) are monster heads from the creator: pumpkin, skull, black cat, vampire, werewolf, zombie, alien and ghost. `create` picks `config.pairs` of them and shuffles two of each into `cards: { face, owner: string | null }[]`.
- **Config:**
  - `PAIRS_DEFAULTS`: 8 pairs, intro 2.5 s, turn 15 s, peek 1.4 s, podium 12 s, bot delay 0.7–1.4 s, bot memory 0.7.
  - `PAIRS_FAST`: 4 pairs, intro 0.6 s, turn 12 s, peek 0.7 s, podium 4 s, bot delay 0.3–0.6 s.
- **Players:** up to 4 humans (`PAIRS_MAX_PLAYERS`). With one human, Jack O'Bot (`BOT_ID`, shared with Trivia) joins. The turn order is the join order.
- **Phases:** `intro → play → podium → done`.
- **Play state:**
  - `turn`: a counter that increases on every hand-over.
  - `current`: an index into the players.
  - `flipped`: card indexes, 0–2 of them.
  - `peekUntil`: set while a mismatched pair is shown.
  - `endsAt`: the turn deadline.
- **`act(player, { turn, card })`** is allowed only when all of these hold:
  - The phase is `play` and no peek is running.
  - `turn` matches.
  - The player is the current one and not gone.
  - `card` is in range, face down (no owner) and not already flipped.

  What happens next:
  - The first card is added to `flipped`.
  - On the second card, a match gives the pair to the player and resets the turn timer, and the same player goes again. When no card is left, the game moves to `podium`.
  - On a mismatch, `peekUntil = now + peekMs`.
- **`advance`:**
  - The intro ends: play starts.
  - The peek ends: `flipped` is cleared and the turn passes.
  - The turn deadline passes: `flipped` is cleared and the turn passes.
  - A bot move is due: the bot flips.
  - The podium ends: `done`.
  - Passing a turn skips players who are gone.
- **Bot:** `botAt` holds when its next flip is due. Its memory is a map of card index to face, filled from every flip anyone makes. Each face is stored with probability `botMemory`, so it forgets some.
  - First flip: if it remembers a full pair still face down, it flips one of them. Otherwise it flips an unknown card at random.
  - Second flip: if it remembers the match of its first card, it flips that. Otherwise it flips an unknown card (not the first).
- **`removePlayer`:** marks the player gone. If it was their turn, the turn passes and `flipped` is cleared.
- **`view`:**
  - `cards[i]` is `{ state: "down" }`, `{ state: "up", face }` (flipped this turn) or `{ state: "matched", face, owner }`.
  - It also carries the players with pairs as `score`, `current`, `turn`, `remainingMs`/`durationMs` and `peek` (a boolean).
  - `lastMatch` is set for 1.2 s after a match, and drives the sound and the highlight.
  - Faces of down cards never appear in the view.

## Server
- `config.ts`: `pairs` is `PAIRS_FAST` when `TRIVIA_FAST=1` (documented as "fast games for E2E"), otherwise `PAIRS_DEFAULTS`.
- `app.ts`: `createGameRegistry({ trivia, pairs })`.
- Migration `006_monster_pairs`: drop and re-add `rooms_game_check` with `('none','pumpkin_trivia','monster_pairs')`.
- `house.ts`:
  - Room 1B (Midnight Library) becomes `monster_pairs`.
  - After the idempotent insert, an `UPDATE` sets the house rooms' game to the seeded value. They are owned by the Concierge, and guests cannot edit them.
- `hub.ts`: unchanged.

## Web
- `ui/GameParts.tsx` holds the shared pieces taken out of `TriviaPanel.tsx`:
  - `useRemaining`
  - `ranked`
  - `Podium`: it takes the players, a score label and the play-again text.
- `ui/PairsPanel.tsx`:
  - A grid of card buttons (`data-testid="pairs-card"`, `data-state`, `data-face` only when visible). The grid is 4×4, or 4×2 in the fast game.
  - The flip uses a CSS 3D `rotateY`. Matched cards wear the owner's initial.
  - A header shows "Your turn!" or "<name>'s turn". There is a timer bar, a scoreboard (pairs) and the podium.
  - SFX: `pick` on a flip, `correct` on a match, `wrong` on a mismatch peek, `fanfare` for the winner.
- `Lobby.tsx`:
  - The start button appears for any room game except `none`, with a label from `GAME_START`.
  - It renders `TriviaPanel` or `PairsPanel` by `view.game`.
- `RoomDirectory.tsx`: the label "🃏 Monster Pairs".
- `npcs.ts`: the host's tint and lines for Monster Pairs.

## Tests
- `packages/shared/test/pairs.test.ts`:
  - The deck has two of each face.
  - Faces stay hidden while down.
  - Turn rules: wrong player, wrong turn, a third flip, a matched card.
  - A match keeps the turn; a mismatch peeks, then passes the turn.
  - The timer passes the turn.
  - A leaving player passes the turn.
  - The bot finishes a solo game.
  - A full game reaches the podium with the pairs summed.
- `apps/server/test/games.test.ts`, new `describe`:
  - Start in a pairs room.
  - No view ever contains a down card's face.
  - Only the current player can flip.
  - A spectator cannot act.
  - Malformed actions are invalid.
  - The game ends at the podium.
- `e2e/pairs.spec.ts`:
  - A solo game against the bot to the podium: on each own turn, click two down cards.
  - Screenshots `desktop-pairs-board.png`, `desktop-pairs-podium.png` and a phone board `phone-pairs-board.png`.
