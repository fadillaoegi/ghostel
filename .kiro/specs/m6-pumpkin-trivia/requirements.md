# Requirements — Milestone 6: Pumpkin Trivia

A short, polished Halloween quiz played together at a room's table, plus a game system that lets more games be added.

## Requirement 1 — Starting a game
1. IN a room whose activity is Pumpkin Trivia, any guest inside SHALL be able to start a game when none is running.
2. Every guest in the room when the game starts SHALL be a player (max 8). Guests who enter later SHALL watch.
3. IF only one human plays, THEN THE server SHALL add a bot opponent ("Jack O'Bot") so a solo judge can play.
4. THE server SHALL refuse to start in the lobby, in rooms with another activity, or while a game runs.

## Requirement 2 — Rounds (server-authoritative)
1. A game SHALL have an intro, 7 questions, and a podium.
2. Each question SHALL show 4 options and a 15-second timer. Each player picks once; the pick cannot be changed.
3. THE question phase SHALL end early when every present player has answered.
4. THE reveal phase (5 s) SHALL show the correct option, who picked what, and the points gained.
5. Scoring: a correct answer earns 500 points plus up to 500 for speed (proportional to time left); a wrong or missing answer earns 0.
6. THE server SHALL own the timer, the question order, the option order, answer checking and scores. Clients only send `{ round, choice }`.
7. THE correct option SHALL NOT be sent to any client before the reveal. A player's own pick SHALL only be sent to that player during the question.
8. Players who leave the room stay on the scoreboard, and the round no longer waits for them.
9. Guests outside the room SHALL NOT receive game state.

## Requirement 3 — Bot
1. THE bot SHALL answer after a random 2.5–9 s with about 65% accuracy, decided on the server.

## Requirement 4 — Presentation
1. THE game SHALL appear as a panel over the room: round counter, timer bar, question, four big colourful answer buttons (keys 1–4 on desktop), who has answered, a live scoreboard, the reveal state, and a podium with medals and a "Play again" button.
2. Short synthesized sound effects (tick, correct, wrong, win) SHALL play, with a mute toggle. No audio files.
3. THE panel SHALL work on phones (2×2 answer grid, bottom sheet).

## Requirement 5 — Game system
1. Games SHALL implement one engine interface in `packages/shared/src/games/` (create, parse action, act, advance, view, remove player, done). The server SHALL run any registered engine without game-specific code in the hub.
2. Question content SHALL be original text written for Ghostel.

## Acceptance criteria
- A solo guest can play a full game against the bot and reach the podium.
- Two guests see the same question at the same time and the same results.
- No message during a question contains the correct answer.
- Answers for the wrong round, a second answer, or answers from spectators are ignored.
- Desktop and phone layouts are usable.
