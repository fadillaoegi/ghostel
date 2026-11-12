# Kiro activity log

Only real, observed activity is recorded here. No time-saved estimates.

## Overview for judges

Ghostel was built from an empty folder with **Kiro CLI 3.1.0** over three sessions (2026-11-07 to 2026-11-09). The owner set goals and made decisions in Indonesian; Kiro wrote the specs, code, tests and docs in English. The owner handled git; Kiro never ran git.

### How Kiro was used
| Kiro feature | What exists in this repo | Evidence |
| --- | --- | --- |
| **Steering** | 7 files in `.kiro/steering/`. Five are always included (product, architecture, security, language and workflow, attribution). `visual-style.md` loads only for files in `apps/web/src/three/` (`fileMatch`). `submission.md` loads only when included by hand (`manual`). | Kiro gave the steering files to the agent as workspace rules during the sessions. They hold decisions (stack, security rules, language, no git) that were never repeated in prompts. |
| **Specs** | 17 milestone folders in `.kiro/specs/` (index: `.kiro/specs/README.md`), each with requirements, design and tasks. M1–M10 and M15–M17 were written before the code. M11–M14 were written after it; their specs say so at the top. | The task lists are ticked in order. Design changes found while coding are written back into the design files. |
| **Hooks** | `.kiro/hooks/`: a PreToolUse guard that blocks git commands and writes to the old project, a SessionStart status hook, and a PostFileSave hook that runs the shared tests. Scripts are in `scripts/kiro-hooks/`, with tests (`pnpm test:hooks`). | `docs/evidence/kiro-hooks.log`, one line per guard or status run. **Proven:** the guard blocked a real Kiro tool call on 2026-11-09 (it was a false positive, which was fixed and covered by a test). The SessionStart hook ran at the start of session 4 (2026-11-09): it wrote a log line and its status text reached the agent's context. **Indirect only:** the PostFileSave hook (the Vitest cache was rewritten one second after an agent save; the hook does not log). |
| **Subagent** | Kiro's `introspect` agent read the official Kiro docs and explained why the first hook never showed output (silent on success; file triggers are V3-only and fire only for agent edits; loaded at session start). | Session 3 log below. |
| **Web research** | Render Free limits, Neon Free limits, Kiroween categories (the Devpost page returns 403, so a secondary source), browser support for screen capture, the PostgreSQL 18 Docker data-path change. | Sources cited in `docs/DEPLOY.md`, `docs/CATEGORY-REPORT.md` and the session logs. |
| **Real checks** | Typecheck, 136 + 8 unit tests, 90 integration tests on PostgreSQL 18, 29 Playwright browser tests (two browsers, fake microphone, camera and screen), production smoke test (latest run 2026-11-10). | `docs/evidence/*.txt` (real output, exit codes, including one failed run kept as-is), 58 screenshots in `docs/evidence/screenshots/`. |

### Decisions the owner made through Kiro (examples)
- Stack, Pumpkin Trivia as the first game, rooms as separate scenes ("sesuai kamu rekomendasikan").
- Door codes 1A–3D so friends can meet "at 2B".
- Dropping the "no video" rule: camera and screen share are allowed but off until clicked.
- Rooms hold 2–8 guests; presentations need the room owner's approval.
- Moving to PostgreSQL 18, after Kiro backed up the dev data first.

### Problems Kiro found and fixed with tests (examples)
- **IP spoofing:** `TRUST_PROXY` meant "trust every forwarded address", which let clients fake their IP to dodge rate limits. It is now a hop count, with a test.
- **Flaky elevator prompt:** the first frame of a new scene sent a move from a guessed spawn point. Fixed by reading the server position during render; then 6 of 6 repeated runs passed.
- **Tables trapping guests:** tables placed too close to pillars left gaps a guest could get stuck in. A unit test now requires a guest-wide gap around every obstacle.
- **Camera refused:** the browser blocked the camera because the server's Permissions-Policy header still said `camera=()`.
- **Blank PDF slides:** pdf.js 6 drew on an unsized canvas and had no standard fonts.
- **Squashed camera tiles:** found from the owner's report and fixed with an E2E ratio check.

### What is not proven yet
- The PostFileSave hook is seen only indirectly: in session 4 the Vitest cache in `packages/shared` was rewritten one second after the agent saved a shared test file. The hook does not log and always exits 0 because of `| tail`, so no direct output was seen. (The guard and SessionStart hooks are proven.)
- Calls, camera and screen share between two real devices on different networks (needs the public HTTPS deploy).
- A real phone, and a real physical gamepad (only fakes were tested).
- The official Devpost rules: the requirements are from secondary sources until the owner provides the official text.

The detailed, chronological log follows.

## Session 1 — 2026-11-07

- **Tool:** Kiro CLI 3.1.0 (`kiro-cli --version`), model shown in the session context: claude-opus-5.5.
- **Working directory:** `/Users/boo/Github/project/Hacketon/ghostel`.
- **Prompt:** the owner pasted the summary of `ghostturtle/GHOSTEL-NEXT-SESSION.md` (milestone 1: character creation, guest name, 3D lobby, realtime presence).

### Decisions
| Decision | Who | Note |
| --- | --- | --- |
| Work in `Hacketon/ghostel` instead of `ghostturtle/ghostel` | Owner ("a") | Kiro had found the mismatch between the prompt and the session folder |
| Stack A (full TypeScript monorepo) | Kiro default, owner did not object | Recorded in steering |
| `ws` instead of Colyseus | Kiro | Colyseus 0.18 / schema 5 was new to us; keeps domain state in `packages/shared` (see design.md) |
| Pumpkin Trivia as first game | Kiro default | Still open for the owner |
| Old project left in place, launcher not stopped | Kiro | Needs explicit owner approval |
| Single-origin deploy (server serves web) | Kiro | Avoids third-party cookies; Render Free spin-down checked in Render docs |

### Kiro features used
- **Steering:** `.kiro/steering/{product,architecture,security,language-and-workflow,attribution}.md`. Kiro injected them as workspace rules right after they were written.
- **Spec:** `.kiro/specs/m1-check-in-and-lobby/{requirements,design,tasks}.md`, written before code and updated with what changed during implementation.
- **Hook:** `.kiro/hooks/shared-tests-on-save.json`, created with Kiro's `createHook` tool (PostFileSave, matcher `packages/shared/(src|test)/.*\.ts$`, runs the shared Vitest suite). The tool reported "The hook will be active on the next session start", so it was **not** seen firing in this session. Its command, run by hand, printed `Test Files 3 passed (3) / Tests 43 passed (43)`.
- **Web search:** Render Free spin-down behaviour (15 minutes without inbound HTTP or WebSocket traffic).

### Files created
Root: `AGENTS.md`, `README.md`, `LICENSE`, `.gitignore`, `.env.example`, `docker-compose.yml`, `infra/postgres-init/01-test-db.sql`, `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `tsconfig.json`, `playwright.config.ts`, `e2e/lobby.spec.ts`.
`packages/shared`: `src/{profile,layout,movement,protocol,index}.ts`, `test/{profile,movement,protocol}.test.ts`.
`apps/server`: `src/{config,app,main}.ts`, `src/db/{pool,migrate,guests}.ts`, `src/http/{session,rate-limit,routes}.ts`, `src/realtime/{hub,upgrade}.ts`, `test/{helpers,session.test,presence.test}.ts`, `build.mjs`, `vitest.config.ts`.
`apps/web`: `index.html`, `public/favicon.svg`, `vite.config.ts`, `src/{main,App}.tsx`, `src/api.ts`, `src/styles.css`, `src/net/presence.ts`, `src/input/controls.ts`, `src/ui/{Creator,Lobby,Joystick}.tsx`, `src/three/{Avatar,LobbyHall,LobbyScene,Decor,nametags}.tsx`, `src/three/textures.ts`.
Docs: `docs/{PROGRESS,HANDOFF,ASSETS,KIRO-ACTIVITY}.md`, `docs/evidence/`.

### Problems found and fixed during the session
1. pnpm 11 ignored `onlyBuiltDependencies`; switched to `allowBuilds` so esbuild's postinstall ran.
2. `@fastify/static` 10 passes a Fastify reply to `setHeaders`; typecheck caught it.
3. First E2E run: a role locator `/Pumpkin/` matched both the head chip and the colour swatch. Fixed with exact names.
4. drei `Html` name tags mounted an empty div (with and without StrictMode). Replaced with a DOM overlay projected per frame.
5. Headless SwiftShader ran the lobby at 2–5 fps and E2E timed out. Measured 61 fps with `--use-angle=metal` on Apple M1 and switched to it on macOS.
6. The first evidence script recorded `$?` after an `echo`, so every exit code read 0. Rewritten to capture the real exit code, then all checks were run again.
7. Screenshot review showed an empty black area south of the hall; added a porch with lamp posts and tombstones.

### Commands and actual results (see `docs/evidence/`)
| Command | Result |
| --- | --- |
| `pnpm typecheck` | exit 0 |
| `pnpm test:unit` | 3 files, 43 tests passed |
| `pnpm test:server` | 2 files, 24 tests passed (real PostgreSQL 17, `ghostel_test`) |
| `pnpm build` | exit 0; web JS 1,276 kB (351 kB gzip), server bundle 23.6 kB |
| `pnpm exec playwright test` | 3 passed |

## Session 1, part 2 — 2026-11-07: Milestone 3 (lobby chat)

- **Prompt:** "oke lanjut, mari kita menangkan kompetisi ini broo" (continue to the next milestone).
- **Spec first:** `.kiro/specs/m3-lobby-chat/{requirements,design,tasks}.md` were written before any code.
- **Hook check:** files in `packages/shared` (`src/chat.ts`, `src/protocol.ts`, `test/chat.test.ts`) were saved in this session. No hook output appeared in the tool results, which matches the `createHook` notice that hooks load at the next session start. It is still unverified.

### Files
- New: `packages/shared/src/chat.ts`, `packages/shared/test/chat.test.ts`, `apps/server/test/chat.test.ts`, `apps/web/src/ui/ChatPanel.tsx`, `e2e/chat.spec.ts`.
- Changed: `packages/shared/src/{protocol,index}.ts`, `apps/server/src/realtime/hub.ts`, `apps/web/src/net/presence.ts`, `apps/web/src/ui/Lobby.tsx`, `apps/web/src/three/{LobbyScene,nametags,Decor}.tsx`, `apps/web/src/styles.css`.

### Problems found and fixed
1. Two tool calls in one batch (write a test file + run tests) raced: the test run started before the new file existed and reported the old count. Re-ran sequentially; these numbers are from the sequential runs.
2. `getByLabel("Message")` also matched the "Send message" button. Switched to `getByRole("textbox", { name: "Message" })`.
3. The phone unread badge counted chat history received on connect (it showed 8). Unread now starts after the history mark.

### Results (see `docs/evidence/`)
| Command | Result |
| --- | --- |
| `pnpm typecheck` | exit 0 |
| `pnpm test:unit` | 4 files, 53 tests passed |
| `pnpm test:server` | 3 files, 30 tests passed |
| `pnpm build` | exit 0; web JS 1,294 kB (355 kB gzip) |
| `pnpm exec playwright test` | 6 passed |

## Session 1, part 3 — 2026-11-07: Milestone 4 (rooms)

- **Prompts:** "nah sesuai kamu rekomendasikan saja dulu ya" (accept the recommendations: Pumpkin Trivia first; rooms as separate scenes). Later, after the owner rejected one file write, "rekomendasi kamu gimana ?".
- **Decisions recorded in steering:** `.kiro/steering/product.md` now marks Pumpkin Trivia and rooms-as-separate-scenes as confirmed.
- **Spec first:** `.kiro/specs/m4-rooms/{requirements,design,tasks}.md`.
- **Rejected tool call:** the owner rejected the first write of `apps/server/src/security/passwords.ts`. Kiro stopped and asked which option the owner wanted. The owner asked for a recommendation; Kiro recommended keeping `@node-rs/argon2` (argon2id, prebuilt binary, no install script that pnpm 11 would block) in `security/`, then wrote the same file.
- **Hook:** still no hook output seen when saving `packages/shared` files this session.

### Files
- New: `packages/shared/src/rooms.ts`, `packages/shared/test/rooms.test.ts`, `apps/server/src/db/rooms.ts`, `apps/server/src/security/passwords.ts`, `apps/server/src/http/{auth,rooms}.ts`, `apps/server/test/rooms.test.ts`, `apps/server/scripts/reset-test-db.mjs`, `apps/web/src/three/RoomInterior.tsx`, `apps/web/src/ui/{RoomDirectory,RoomSettings}.tsx`, `e2e/rooms.spec.ts`.
- Renamed: `apps/web/src/three/LobbyScene.tsx` → `WorldScene.tsx` (layout-aware, lobby or room).
- Changed: `packages/shared/src/{layout,movement,protocol,index}.ts`, `apps/server/src/{app.ts,db/migrate.ts,http/routes.ts,realtime/hub.ts}`, `apps/server/package.json`, server tests (`TRUNCATE … CASCADE`), `apps/web/src/{api.ts,net/presence.ts,ui/Lobby.tsx,ui/ChatPanel.tsx,three/LobbyHall.tsx,styles.css}`, `playwright.config.ts`, `e2e/chat.spec.ts`.

### Problems found and fixed
1. E2E: the chat field kept focus after sending, so walking keys typed text. The docked chat now blurs after sending; `chat.spec.ts` checks it.
2. E2E database kept rooms from earlier runs. Added a reset script that only runs on `*_test` databases.
3. Parallel tool calls again: one E2E run used a build made before an edit landed. Rebuilt and ran checks one after another.
4. Chat notices "checked in/out" were confusing next to room entry and exit; changed to "arrived" and "left".

### Results (see `docs/evidence/`)
| Command | Result |
| --- | --- |
| `pnpm typecheck` | exit 0 |
| `pnpm test:unit` | 5 files, 67 tests passed |
| `pnpm test:server` | 4 files, 43 tests passed |
| `pnpm build` | exit 0; web JS 1,313 kB (360 kB gzip) |
| `pnpm exec playwright test` | 8 passed |

## Session 1, part 4 — 2026-11-07: Milestone 5 (voice)

- **Prompt:** "oke lanjut".
- **Spec first:** `.kiro/specs/m5-voice/{requirements,design,tasks}.md`.
- **Hook:** still not seen firing in this session.

### Files
- New: `packages/shared/src/voice.ts`, `packages/shared/test/voice.test.ts`, `apps/server/src/http/voice.ts`, `apps/server/test/voice.test.ts`, `apps/web/src/net/voice.ts`, `apps/web/src/ui/VoiceControls.tsx`, `e2e/voice.spec.ts`.
- Changed: `packages/shared/src/{protocol,index}.ts`, `apps/server/src/{config,app}.ts`, `apps/server/src/realtime/hub.ts`, `apps/server/test/helpers.ts`, `apps/web/src/net/presence.ts`, `apps/web/src/ui/{Lobby,ChatPanel}.tsx`, `apps/web/src/three/{WorldScene,nametags}.tsx`, `apps/web/src/styles.css`, `playwright.config.ts`, `.env.example`.

### Problems found and fixed
1. E2E: "Join voice" stayed on "Connecting…". Tracing the WebSocket frames showed `voice_join` was never sent because `getUserMedia` did not resolve. A standalone script on one focused page worked. Chrome holds the microphone request until the page has focus, so the test now calls `bringToFront()` first.
2. Screenshots showed overlapping name tags when avatars stand together; the tag projector now nudges overlapping tags apart.
3. Parallel tool calls again caused one stale typecheck (a new file had not been written yet). Re-ran in order.

### Results (see `docs/evidence/`)
| Command | Result |
| --- | --- |
| `pnpm typecheck` | exit 0 |
| `pnpm test:unit` | 6 files, 73 tests passed |
| `pnpm test:server` | 5 files, 51 tests passed |
| `pnpm build` | exit 0 |
| `pnpm exec playwright test` | 9 passed |

## Session 1, part 5 — 2026-11-07: Milestone 6 (Pumpkin Trivia)

- **Prompt:** "ya lanjut".
- **Spec first:** `.kiro/specs/m6-pumpkin-trivia/{requirements,design,tasks}.md`.
- **Content:** the 36 trivia questions in `packages/shared/src/games/trivia-questions.ts` were written for Ghostel in this session (no copied question sets).
- **Hook:** still not seen firing in this session.

### Files
- New: `packages/shared/src/games/{engine,trivia,trivia-questions,index}.ts`, `packages/shared/test/trivia.test.ts`, `apps/server/test/games.test.ts`, `apps/web/src/ui/{TriviaPanel.tsx,sfx.ts}`, `e2e/trivia.spec.ts`.
- Changed: `packages/shared/src/{protocol,index}.ts`, `apps/server/src/{config,app}.ts`, `apps/server/src/realtime/hub.ts`, `apps/server/test/helpers.ts`, `apps/web/src/net/presence.ts`, `apps/web/src/ui/Lobby.tsx`, `apps/web/src/styles.css`, `playwright.config.ts`.

### Problems found and fixed
1. A unit test expected the first recorded phase to be "question"; the engine correctly starts with "intro". The test was wrong and was fixed.
2. Integration tests: `TestSocket.next` also matches older messages, so "wait for the next welcome/game" sometimes returned a stale one. Added an `after(index)` helper.
3. Screenshot review: the reveal animation started the correct answer at opacity 0, and the panel was too transparent over the bright ballroom. Changed the animation to scale only and made the panel almost opaque.
4. Parallel tool calls once ran the server tests before `games.test.ts` existed (51 instead of 57). Re-ran in order.

### Results (see `docs/evidence/`)
| Command | Result |
| --- | --- |
| `pnpm typecheck` | exit 0 |
| `pnpm test:unit` | 7 files, 86 tests passed |
| `pnpm test:server` | 6 files, 57 tests passed |
| `pnpm build` | exit 0 |
| `pnpm exec playwright test` | 11 passed |

## Session 1, part 6 — 2026-11-07: Milestone 7 (atmosphere and NPC ghosts)

- **Prompt:** "point 1 dulu ya kerjakan" (atmosphere before deployment).
- **Spec first:** `.kiro/specs/m7-atmosphere/{requirements,design,tasks}.md`.
- **Design decision:** NPC movement is a pure function of time in shared code, not server-driven, so it costs no bandwidth and stays the same for every client up to clock skew.
- **Hook:** still not seen firing in this session.

### Files
- New: `packages/shared/src/npcs.ts`, `packages/shared/test/npcs.test.ts`, `apps/server/src/db/house.ts`, `apps/server/test/house.test.ts`, `apps/web/src/three/Npcs.tsx`, `apps/web/src/ui/ambience.ts`, `e2e/atmosphere.spec.ts`.
- Changed: `packages/shared/src/index.ts`, `apps/server/src/app.ts`, `apps/web/src/three/{WorldScene,nametags}.tsx`, `apps/web/src/ui/Lobby.tsx`, `apps/web/src/styles.css`.

### Problems found and fixed (from screenshot review)
1. Phone HUD: the status pill wrapped onto three lines and covered "Join voice"; the trivia button covered the room sign. The status now fits on one line (the dot shows the connection state) and the button moved above the joystick.
2. Mortimer's greeting bubble went off the top of the screen on phones. Tags and bubbles are now kept below the top HUD.
3. Parallel tool calls again: two runs started before new files existed. Re-ran in order; the numbers below are from ordered runs.

### Results (see `docs/evidence/`)
| Command | Result |
| --- | --- |
| `pnpm typecheck` | exit 0 |
| `pnpm test:unit` | 8 files, 91 tests passed |
| `pnpm test:server` | 7 files, 60 tests passed |
| `pnpm build` | exit 0 |
| `pnpm exec playwright test` | 13 passed |

## Session 1, part 7 — 2026-11-07: Deployment preparation

- **Prompt:** "lanjut".
- **Web research:** Render Free limits (https://render.com/docs/free: 15-minute spin-down, 750 instance hours per month, free Postgres expires after 30 days) and the Neon Free plan (https://neon.com/faqs/free-plan-limits-and-quotas: 100 CU-hours and 1 GB per project). Summaries are in `docs/DEPLOY.md`.
- **Not done:** the actual deploy. Creating the Render and Neon accounts needs the owner.

### Files
- New: `render.yaml`, `.node-version`, `.github/workflows/keep-alive.yml`, `docs/DEPLOY.md`, `playwright.prod.config.ts`, `e2e-prod/production.spec.ts`, `apps/server/test/proxy.test.ts`.
- Changed: `apps/server/src/{config,app}.ts` (`TRUST_PROXY` hop count), `apps/server/test/helpers.ts`, `package.json` (`test:prod`), `tsconfig.json`, `.env.example`, README, HANDOFF, PROGRESS.

### Problems found and fixed
1. `TRUST_PROXY=1` used to mean "trust every X-Forwarded-For entry", which lets a client spoof its IP and dodge rate limits. It is now a hop count, with a test.
2. Fastify's types do not accept a number for `trustProxy`, so a trust function `(addr, hop) => hop < n` is used instead.
3. pnpm skips devDependencies when `NODE_ENV=production`, which would break the Render build. The build command installs with `NODE_ENV=development`, simulated from a clean copy.
4. The agent shell blocked running `pnpm start` directly. The production smoke test runs the same `apps/server/dist/main.js` with `NODE_ENV=production` through Playwright instead.

## Session 2 — 2026-11-08: Milestone 8 (floors, music, candy hunt) and the category report

- **Prompt (owner):** replace the background sound with fitting melodic music; make the building bigger with floor 1 as the lobby and floors 2–4 designed by Kiro; report which competition category each part serves.
- **Spec first:** `.kiro/specs/m8-floors-and-music/{requirements,design,tasks}.md`.
- **Research:** the official Devpost pages returned HTTP 403. Categories and requirements were taken from the AWS Builder Center "Kiro Weekly Reading List – 1st November 2026", and the report says so.
- **Design choices made by Kiro (owner delegated):** floor 2 Hall of Portraits, floor 3 Moonlit Greenhouse, floor 4 Rooftop Graveyard, plus a server-checked candy hunt that unlocks a crown, to give judges a reason to visit every floor. The music is original and performed live with Web Audio (no recordings, so there is no license question).
- **Local server:** a Ghostel server started at 15:00 (PID 17349, not started by Kiro in this step) was still running the old build. Kiro did not stop it.
- **Hook:** still not seen firing.

### Problems found and fixed
1. Old tests used "crown" as an example of an invalid hat. Crown is now a real (gated) hat, so the tests use "tiara".
2. Responses gained a `candies` field; two session tests compared the old exact shape and were updated.
3. Screenshot review: the floor 2 elevator and mirror were on side walls and seen edge-on by the camera, and the hall was too dark. Both moved to the north wall and the lighting went up. Portraits then overlapped the armour, which a unit test caught; they were moved.
4. Flaky E2E (2 of 4 runs): after an elevator ride the prompt sometimes did not appear. First fix tried: a scene epoch on moves (kept, it closes a real gap) but the flake remained. Real cause: the new scene's first frame could run before the effect that loads the server-given position, so it sent a move from a guessed spawn point and pulled the server position away from the elevator. Fixed by reading the position during render and not sending moves until placed. 6 of 6 repeated runs passed, then the full suite passed.
5. The music test's expected sort order was wrong ("rooftop" sorts before "room").

### Results (see `docs/evidence/`)
| Command | Result |
| --- | --- |
| `pnpm typecheck` | exit 0 |
| `pnpm test:unit` | shared 9 files / 100 tests, web 1 file / 7 tests |
| `pnpm test:server` | 9 files, 69 tests |
| `pnpm build` | exit 0; web JS 1,383 kB (379 kB gzip) |
| `pnpm exec playwright test` | 16 passed |
| `playwright test -c playwright.prod.config.ts` | 1 passed |

## Session 2, continued — 2026-11-08: Milestone 9 (room doors, night city, monster variety)

- **Prompt (owner, Indonesian, summarised):** make floors 2 and 3 reach rooms so guests can arrange to meet "on floor 2 or 3, room A or B"; show a city at night below floor 4; more ghost variants for NPCs (vampire, monster…) and in the character creator.
- **Proposal by Kiro, accepted by the owner ("oke"):** door codes 1A–1D in the lobby (house rooms in 1A–1C), 2A–2F on the gallery's north wall, 3A–3D in the greenhouse. Walk up to a door and press E.
- **Spec first:** `.kiro/specs/m9-monsters-city-doors/{requirements,design,tasks}.md`; all tasks ticked.
- **Context:** this session hit the context limit mid-milestone and continued from Kiro's own summary. Server door logic was done before the summary; the integration tests, web door UI, E2E and docs after it.
- **Hook:** still not seen firing.

### Files
- New: `packages/shared/src/doors.ts`, `packages/shared/test/doors.test.ts`, `apps/server/test/doors.test.ts`, `apps/web/src/three/RoomDoors.tsx`, `apps/web/src/three/floors/City.tsx`.
- Changed (main ones): `packages/shared/src/{profile,npcs,floors,rooms,protocol,candies}.ts`, `packages/shared/src/games/trivia.ts` (`TRIVIA_FAST` question time), `apps/server/src/db/{migrate,rooms,house}.ts` (migration 004), `apps/server/src/http/rooms.ts`, `apps/server/src/realtime/hub.ts`, `apps/server/src/app.ts`, `apps/web/src/{api.ts,net/presence.ts}`, `apps/web/src/three/{Avatar,Npcs,WorldScene,LobbyHall,textures}.tsx`, `apps/web/src/three/floors/Rooftop.tsx`, `apps/web/src/ui/{Lobby,RoomDirectory,Creator}.tsx`, `apps/web/src/styles.css`, all E2E specs.

### Problems found and fixed
1. Two integration tests still expected the pre-door room shape and the old "Back to the lobby!" notice. Updated, then 11 door tests were added (door choice, 409s, live labels per floor, exit at the door, house doors, stale cleanup, migration on a scratch schema).
2. The migration's "no free door" check used `free IS NULL` on a record; changed to `IF NOT FOUND` before the migration shipped anywhere.
3. `house.test.ts` could fail depending on file order: a guest room left behind door 1A by an earlier test file would block the house room seed. The test now clears guest rooms on floor 1 first. (Production always has the house rooms first.)
4. A fixed-time walk to a door and the trivia question window each failed once in full E2E runs on a busy machine: slow frames are clamped, so a fixed key-hold covers less distance. Walks now hold the key until the door prompt appears; `TRIVIA_FAST` questions last 12 s.
5. Investigated slower E2E (3–6 min vs 1.7 min in M8) with throwaway probes: one lobby page runs at 60 fps; temporarily hiding the doors and NPC avatars changed neither main-thread time (~150 ms/s) nor new-page load time. Recorded as open in HANDOFF, not fixed.
6. Agent pitfall again: a probe script was written and run in the same batch and was not found. Re-run in order.

### Results (see `docs/evidence/`)
| Command | Result |
| --- | --- |
| `pnpm typecheck` | exit 0 |
| `pnpm test:unit` | shared 10 files / 104 tests, web 1 file / 7 tests |
| `pnpm test:server` | 10 files, 80 tests |
| `pnpm build` | exit 0; web JS 1,411 kB (386 kB gzip) |
| `pnpm exec playwright test` | 18 passed (3.3 min) |
| `playwright test -c playwright.prod.config.ts` | 1 passed |

New screenshots: `desktop-door-prompt.png` (floor 2 doors, 2B ajar), `desktop-floor3-doors.png`, `desktop-door-occupied.png`, `desktop-creator-monsters.png`, `desktop-lobby-monsters.png`; `desktop-floor4-rooftop.png` now shows the city.

## Session 3 — 2026-11-08/09: Milestones 10–14 (Diner, phone gamepad, seats and meetings, camera, presentations)

- **Prompts (owner, Indonesian, summarised):** a presentation feature like Zoom in rooms; a canteen on floor 4 with the rooftop moved to floor 5; responsive phone play with an analog stick in portrait and landscape; then "do both" (screen share and PDF), everyone presents with the room owner's approval, open the camera, a long table per room sized by the member count, tables for 2 and 4 on every floor where seated guests talk right away in a Zoom-like view.
- **Decisions Kiro proposed, owner confirmed ("oke laksanakan"):**
  - Change the "no video" rule: camera and screen share allowed, off until clicked.
  - Peer-to-peer mesh, so rooms hold 2–8 guests and camera tiles are small.
  - One call per room, one per floor table.
  - PDF slides kept in server memory only (≤ 10 MB).
  - Rooftop candies keep their ids on floor 5 and the Diner has none, so no guest loses the crown.
  - Physical gamepad support.
- **Steering changed:** `product.md` (communication, seats, presentations, floors, phones; milestone list), `security.md` (calls, seats, device permissions, presentation files).
- **Spec order, stated honestly:** the M10 spec was written before its code. M11's spec was written right after its code. The M12–M14 specs were written after those milestones were built, in the same long session, instead of before. Kiro could keep the M12–M14 decisions consistent because they had been agreed in chat first, but the workflow rule "spec before implementation" was not followed for M11–M14.
- **Hook:** still not seen firing.

### Files (main ones)
- New, shared and server: `packages/shared/src/{tables,canteen,calls}.ts`, `packages/shared/test/tables.test.ts`, `apps/server/src/http/slides.ts`, `apps/server/test/{calls,presentations}.test.ts`.
- New, web and E2E: `apps/web/src/net/call.ts`, `apps/web/src/ui/{MeetingView,Presentation,SnackMenu}.tsx`, `apps/web/src/three/{Tables,Snack}.tsx`, `apps/web/src/three/floors/Canteen.tsx`, `e2e/{diner,mobile,present}.spec.ts`.
- Removed: `apps/web/src/net/voice.ts`, `apps/web/src/ui/VoiceControls.tsx`, `apps/server/test/voice.test.ts`. Their `voice_*` protocol was replaced by seats and calls, and the tests moved to `calls.test.ts` and `e2e/voice.spec.ts`.
- Changed (main ones):
  - Shared: `floors.ts`, `layout.ts`, `rooms.ts`, `protocol.ts`, `npcs.ts`, `candies.ts`, `voice.ts`.
  - Server: `hub.ts`, `migrate.ts` (migration `005_room_capacity`), `db/rooms.ts`, `http/rooms.ts`, `app.ts` (Permissions-Policy, slides routes).
  - Web: `Lobby.tsx`, `WorldScene.tsx`, `Avatar.tsx`, `RoomInterior.tsx`, `RoomDirectory.tsx`, `Joystick.tsx`, `controls.ts`, `presence.ts`, `music.ts`, `scores.ts`, `styles.css`, `vite.config.ts`.
  - `pdfjs-dist` 6.5.438 added.

### Problems found and fixed
1. Tables placed too close to pillars or walls made `constrainToWorld` leave points inside obstacles (narrow gaps trap the push-out). A new unit test requires a guest-wide gap around every table, and the lobby tables were moved twice.
2. A lobby NPC (Wisp) walked through a new table; caught by the NPC path test; table moved.
3. Touch layout: the stick zone covered the footer buttons (same stacking context), then the buttons slid to the left because the stick left the layout flow. Fixed with z-index and `margin-left: auto`, found from E2E failures and screenshots.
4. Remote speaking detection stayed off because the AudioContext was created before any gesture; it is now primed on the first tap or key press, and remote analysers are created once it runs.
5. The camera was refused: the server's Permissions-Policy still said `camera=()`. It now allows camera, microphone and display capture for this origin only.
6. Slides rendered blank: pdf.js 6 does not resize the canvas (it stayed 300×150) and needed its standard fonts. The canvas is sized from the viewport, and a Vite plugin serves the fonts.
7. pdf.js 6 no longer has the `isEvalSupported` option written in the first draft of `security.md`; the rule was corrected (no eval path, `useWasm: false`, `enableXfa: false`).
8. Oversized uploads: the server answers 413 and may cut the connection before the client finishes sending; the test accepts either.
9. Agent pitfalls: a few Python patch replacements silently did not match (for example `PublicPlayer.seat`); typecheck caught them. The debug server served stale assets after a rebuild because static files are registered at startup.

### Results (see `docs/evidence/`, run in order on 2026-11-09)
| Command | Result |
| --- | --- |
| `pnpm typecheck` | exit 0 |
| `pnpm test:unit` | shared 11 files / 116 tests, web 1 file / 8 tests |
| `pnpm test:server` | 11 files, 87 tests |
| `pnpm build` | exit 0; web JS 1,455 kB (399 kB gzip) plus lazy pdf.js 444 kB and its worker |
| `pnpm exec playwright test` | 25 passed (8.2 min) |
| `playwright test -c playwright.prod.config.ts` | 1 passed |

## Session 3, continued — 2026-11-09: squashed camera tiles, PostgreSQL 18

- **Prompt (owner):** "the user's camera looks squashed during a presentation, fix it". The attached screenshot reached Kiro only as a generic PNG icon, so the fix was based on the description and the CSS.
  - **Cause:** with a presentation on the meeting stage, the tiles become a strip. The later one-person and phone grid rules overrode the strip's column size, and the rows used `1fr`, so the tiles were stretched flat.
  - **Fix:** tiles are always 4:3 (`aspect-ratio`), and the strip has fixed 160 px columns (120 px on phones), in a block that comes last in `styles.css`.
  - **Test:** `e2e/present.spec.ts` now seats a guest with the camera on during a screen share and checks every tile's ratio is 4:3 (1.28–1.39) with `object-fit: cover`. Screenshot `desktop-present-meeting-camera.png`.
- **Prompt (owner):** "make the app use the PostgreSQL 18 that is in Docker, delete PostgreSQL 17".
  - The dev database (2 guests, 4 rooms, 5 migrations) was backed up first with `pg_dump` to `backups/` (now gitignored).
  - `docker-compose.yml` now uses `postgres:18-alpine` with a new volume `ghostel_pg18` mounted at `/var/lib/postgresql`. The 18 images keep data in `/var/lib/postgresql/18/docker`, so the old `.../data` mount would not persist.
  - The dump was restored with `pg_restore --exit-on-error` (exit 0) and the same row counts.
  - The old `ghostel_ghostel_pg` volume and the `postgres:17-alpine` image (used by no other container) were removed. Other projects' containers and volumes were not touched.
- **Interruptions, recorded as they happened:**
  1. Docker Desktop was not running, so PostgreSQL refused connections. Kiro started Docker Desktop.
  2. The Playwright browser cache (`~/Library/Caches/ms-playwright`) was emptied by something outside this session at 07:12, during an E2E run, so 24 tests failed at browser launch. Kiro reinstalled Chromium with `playwright install chromium`.
  3. Two shell calls hit the tool timeout and killed the E2E run, leaving its test server behind. Kiro stopped the server and ran the suite detached with `nohup`.
- **Flaky test seen once:** `floors.test.ts` "the Golden Crown is locked…" failed once in the first PostgreSQL 18 run (its candy update came back empty). It passed in 3 single runs and in the full rerun that is now in the evidence. The cause is not known yet.

### Results on PostgreSQL 18.4 (see `docs/evidence/`, 2026-11-09)
| Command | Result |
| --- | --- |
| `pnpm typecheck` | exit 0 |
| `pnpm test:unit` | 116 shared + 8 web |
| `pnpm test:server` | 87 passed (rerun after the flaky crown test) |
| `pnpm build` | exit 0 |
| `pnpm exec playwright test` | 25 passed (5.9 min) |
| `playwright test -c playwright.prod.config.ts` | 1 passed |

## Session 3, continued — 2026-11-09: minimize the presentation

- **Prompt (owner, with a screenshot of the floating panel covering the room):** the presentation should be minimizable so guests can watch it on the room's TV.
- **Change:**
  - The floating presentation panel gets a "–" button. It shrinks to a 220 px corner thumbnail (150 px on phones), and "⤢" restores it. It opens full size again for every new presentation.
  - Folding the meeting view keeps a small stage thumbnail too.
  - The stage is never unmounted while minimized, because the room's TV texture copies its `<video>` or `<canvas>`.
- **Test:** `e2e/present.spec.ts` minimizes the panel during a live screen share. It checks the panel width is under 260 px, the stream is still live, the video's `currentTime` keeps advancing, and restoring brings the panel back to over 400 px.
  - Screenshot `desktop-present-minimized.png` shows the wall TV with the shared screen.
  - `present.spec.ts` + `voice.spec.ts`: 4 passed.

## Session 3, continued — 2026-11-09: M15, a provable Kiro workflow

- **Prompt (owner):** focus on tidying the Kiro story (steering, specs, hooks proven to run, activity log) and re-checking the official Devpost rules. Kiro proposed a plan; the owner approved it ("oke lanjut").
- **Spec first:** `.kiro/specs/m15-kiro-workflow/{requirements,design,tasks}.md`.
- **Research:**
  - `kiroween.devpost.com/rules` still returns HTTP 403 to Kiro's fetch tool, and a web search found no copy of the 2026 rules.
  - Kiro's `introspect` agent answered from the official Kiro docs (kiro.dev/docs/hooks…). File triggers are V3-only and react only to agent edits. A hook that exits 0 is silent for most triggers. Hooks load at session start. `timeout` belongs on the hook.
- **Hooks:**
  - New: `guard-git-and-old-project.json` (PreToolUse) and `session-status.json` (SessionStart), both created with Kiro's `createHook` tool.
  - Scripts in `scripts/kiro-hooks/`, with tests: `pnpm test:hooks` passes, see `docs/evidence/test-hooks.txt`.
  - Kiro asked to replace `shared-tests-on-save.json`. The owner denied changes to that file, so it is unchanged.
- **The guard hook fired in this session**, although `createHook` had said the hooks would be active at the next session start.
  - At 2026-11-09T14:34:57Z Kiro intercepted one of Kiro's own shell commands, replying "Tool "execute_bash" was intercepted by PreToolUse hooks before execution" with the guard's reason. It wrote the first line of `docs/evidence/kiro-hooks.log`.
  - It was a **false positive**: the command was a Python heredoc writing documentation that quoted `git status`; it ran no git.
  - Kiro fixed the guard to ignore heredoc bodies and quoted strings (`stripData`). It added the real case as a unit test (still 5 tests, all passing) and re-ran the blocked edit.
  - This is the first time a project hook was observed running.
- **Not observed yet:** the `session-status` hook (SessionStart) and the PostFileSave hook.
- **Steering:**
  - `architecture.md`: storage, channels, calls, PostgreSQL 18, ports.
  - `language-and-workflow.md`: a hooks section and a rule for specs written late.
  - New `visual-style.md` (`inclusion: fileMatch`) and `submission.md` (`inclusion: manual`).
- **Specs:**
  - `design.md` added for M13 and M14.
  - "Written after implementation" notes on M11–M14; "superseded" notes on M5 and M8.
  - Index `.kiro/specs/README.md`.
- **Activity log:** an "Overview for judges" section was added at the top of this file.

## Session 4 — 2026-11-09: SessionStart hook observed (M15 task 3)

- **Tool:** Kiro CLI, a fresh session started in `/Users/boo/Github/project/Hacketon/ghostel`. Model shown in the session context: claude-opus-5.5.
- **Prompt (owner, Indonesian, summarised):** read `AGENTS.md` and `docs/HANDOFF.md`, verify M15 task 3, show `docs/evidence/kiro-hooks.log`, check for a `session-status … SessionStart` line from this session start, describe the status received at session start, record only what was seen, no git.
- **What reached the agent's context at session start:** a block labelled "Session Start Hook Output" with the text printed by `scripts/kiro-hooks/session-status.mjs`:
  - "Ghostel project status (from the SessionStart hook in .kiro/hooks/session-status.json)" and the reminder to read `AGENTS.md`, `.kiro/steering/` and `docs/HANDOFF.md`.
  - 13 open items from `docs/HANDOFF.md`, numbered 1–13 by the script (HANDOFF numbers them 0–12 with item 8 last). Titles that end in a colon inside the bold text appear cut short, for example "Owner decisions still open:".
  - Latest checks: build exit 0 (2026-11-09 07:33), test-e2e exit 0 (08:11), test-hooks exit 0 (21:44), test-prod exit 0 (08:17), test-server-integration exit 0 (07:53), test-unit exit 0 (07:31), typecheck exit 0 (21:34).
- **Log line:** `docs/evidence/kiro-hooks.log` gained a second line, `2026-11-09T14:56:37.075Z	session-status	SessionStart	13 open items, 7 evidence files`. The file's modification time is the same second (21:56:37 WIB). Kiro's first shell command in this session ran at 14:57:21Z, 44 seconds later, and the counts match the context block (13 items, 7 checks). The log line does not record a session id, so the link to this session rests on that timing and those counts.
- **Result:** the SessionStart hook is now observed in a real session. The PostFileSave hook is still not observed: no file in `packages/shared` was saved in this session, and that hook does not log when tests pass. M15 task 3 stays open for that reason.
- **Git:** none run.

### Session 4, continued: PostFileSave hook observed indirectly

- **Prompt (owner):** "lalu bagaimana ? caranya agar ada file shared ?" (how do we get a shared file saved?). Kiro proposed two options; the owner chose the one that leaves the hook file unchanged ("oke lanjut").
- **Finding first:** the hook command in `shared-tests-on-save.json` ends in `| tail -n 8`, so its exit code is the exit code of `tail`. `false | tail -n 8` returned exit 0 in both `sh` and `zsh`. The hook is therefore silent even when the tests fail. The earlier note "only visible when tests fail" was wrong. The file was not changed.
- **Method:** Vitest rewrites its cache file `packages/shared/node_modules/.vite/vitest/<hash>/results.json` after each run. Kiro re-saved `packages/shared/test/chat.test.ts` with identical content and compared timestamps.
  - Before (15:02:31Z): `results.json` last modified 21:44:41 WIB. `pgrep -fl vitest` found no running Vitest. `chat.test.ts` SHA-256 `2dad1671…bfba6`, last modified 2026-11-07.
  - Kiro wrote the file with `fs_write` (same content). The tool result showed no hook output.
  - After (15:03:27Z): `chat.test.ts` last modified 22:03:14 WIB, SHA-256 unchanged. `results.json` last modified **22:03:15 WIB**, one second later. No Vitest process was still running. Kiro ran no test command between the two checks.
- **Result:** a Vitest run in `packages/shared` started right after the agent's save, which is what the PostFileSave hook does. This is indirect evidence: the hook writes nothing to `kiro-hooks.log`, and its output did not reach the agent's context.

### Session 4, continued: submission rules check

- **Prompt (owner):** "oke sekarang apalagi akar memenuhi rules kompetisi dulu ya ?" (what is still needed to meet the competition rules?).
- **Research:** `https://kiroween.devpost.com/rules` and `https://kiroween.devpost.com/` both returned HTTP 403 to Kiro's fetch tool again. A web search returned a snippet from `kiroween.devpost.com` (search snippet only, not the full page) saying only new projects are eligible: they must be built during the submission period, October 30 to December 4, 2026. Ghostel's first session was on 2026-11-07. Other results were Kiroween 2025 pages and other hackathons, so they were not used as 2026 rules.
- **Finding in the repo:** `.gitignore` contains `*.log`, which also ignores `docs/evidence/kiro-hooks.log`, the only log of the hook runs. Not changed yet; waiting for the owner.
- **Fix (owner: "gitignore dulu"):** added `!docs/evidence/kiro-hooks.log` right after `*.log` in `.gitignore`. Kiro also listed generated and secret files in the working tree (`find`, without git). Each one is already covered by an existing rule: `.env`, `backups/` (the PostgreSQL 17 dump), `apps/*/dist`, `playwright-report/`, `test-results/`, `node_modules/`. `.env.example` holds only the documented local-only credentials. Not checked with `git check-ignore`, because git is the owner's job.

### Session 4, continued: public repository

- **Owner, in their own terminal (pasted to Kiro):** `git init`, `git add .`, `git commit -m "first init"` (root commit `2a41260`, 264 files), then pushed to `https://github.com/fadillaoegi/ghostel` (branch `main`). Kiro ran no git command. The guard hook did not fire, because these commands did not go through Kiro.
- **Kiro checked, without git:**
  - The pasted file list includes `.kiro/` (hooks, specs, steering), `LICENSE`, `docs/evidence/kiro-hooks.log` and all 52 screenshots. It contains no `.env`, `backups/`, `dist/`, `node_modules/`, `playwright-report/` or `test-results/`.
  - A `find` of the working tree, minus the ignored paths, also counts 264 files, the same number as the commit.
  - `https://api.github.com/repos/fadillaoegi/ghostel` (fetched 2026-11-09): `"visibility":"public"`, `"license":{"spdx_id":"MIT"}`, default branch `main`, pushed at 2026-11-09T15:11:19Z.

## Session 4, continued — 2026-11-10: Milestone 16 (Haunted Mirror, Night Desk)

- **Prompts (owner, Indonesian, summarised):**
  - "Make Ghostel fit every category." Kiro answered that the official page says to pick one category. The owner replied that he will submit to Costume Contest but wants parts of the other categories inside Ghostel.
  - Kiro proposed one feature per category. The owner chose "Frankenstein and Resurrection first; Skeleton Crew later".
  - During the work: "always keep the rules and the competition requirements up to date".
- **Assumption stated by Kiro:** the owner did not pick between the two Resurrection ideas, so Kiro took its own recommendation (the CRT terminal, not the Morse telegraph).
- **Spec first:** `.kiro/specs/m16-mirror-and-night-desk/{requirements,design,tasks}.md`, written before any code. All 7 tasks are ticked, and the changes found while building are listed in `tasks.md`.
- **Steering updated:**
  - `product.md`: the category plan, the "pick a category" and new-project notes, the decision and the milestone.
  - `security.md`: the mirror camera rule, and "client-only features add no server input".
  - `submission.md`: rewritten with the eligibility notes and the "Also inside the hotel" item.
- **Subagent:** a `context-gatherer` run mapped the mirror, prompt zones, lobby layout, video textures, candies, overlays, headers and E2E helpers before the spec was written.
- **Package added:** `@fontsource/vt323` 5.3.0. Its OFL 1.1 license was read in the package's `LICENSE` file.
- **Problems found and fixed:**
  1. The movement grid sweep (`movement.test.ts`) failed with the first desk box, which was flush with the wall: push-out could send a point north into the wall and back inside. The box now reaches into the wall.
  2. The first screenshots showed the desk too small and hidden by the avatar, and the fake camera almost white in the mirror. Kiro enlarged the monitor, added a glowing plaque and softened the shader's brightness curve, then looked at new screenshots.
  3. An unused helper (`trackState`) was removed before the tests were written. The E2E test checks the camera with a `getUserMedia` spy in an init script instead.
- **PostFileSave hook:** shared files were saved many times in this milestone. No hook output appeared in the tool results; the hook is silent by design (see the earlier entry).

### Results (see `docs/evidence/`, run in order on 2026-11-10)
| Command | Result |
| --- | --- |
| `pnpm typecheck` | exit 0 |
| `pnpm test:unit` | shared 12 files / 128 tests, web 1 file / 8 tests |
| `pnpm test:server` | 11 files, 87 tests |
| `pnpm build` | exit 0; web JS 1,473 kB (405 kB gzip) |
| `pnpm exec playwright test` | 27 passed (2.7 min) |
| `pnpm test:prod` | 1 passed |

New screenshots: `desktop-night-desk-lobby.png`, `desktop-night-desk.png`, `desktop-mirror-camera.png`.

## Session 4, continued — 2026-11-10: Milestone 17 (Ghostel Game Kit, Monster Pairs)

- **Prompts (owner, Indonesian, summarised):**
  - "Which ideas do you know for a Skeleton Crew element?" Kiro proposed four:
    - A: a second game on the existing kit
    - B: musical chairs
    - C: the hotel as a template
    - D: an NPC template
  - Kiro recommended A, and the owner chose it ("oke lanjut A").
- **Spec first:** `.kiro/specs/m17-game-kit-monster-pairs/{requirements,design,tasks}.md`. All 8 tasks are ticked, and the changes found while building are listed in `tasks.md`.
- **Steering updated:**
  - `product.md`: the second game decision, the milestone 8 note and the category plan.
  - `submission.md`: the "Also inside the hotel" item.
- **Database:** before adding migration `006_monster_pairs`, Kiro backed up the dev database with `pg_dump` to `backups/ghostel-pg18-before-006-20261110-142214.dump`.
  - The dev database is not migrated yet. A dev server started on 2026-11-09 20:25 (PID 27722, not started by Kiro in this session) was still running the old build, and Kiro did not stop it.
- **New document:** `docs/GAME-KIT.md`. It has the interface, what the hub does with it, the steps M17 actually took, and a skeleton marked as an example that is not in the codebase.
- **Problems found and fixed:** see `tasks.md`. In short:
  - The turn hand-over had to move from `removePlayer` to `advance`.
  - The test players had to remember faces.
  - The migration test needed the pre-006 game for room 1B.
  - A phone E2E test took a door that a later spec needed.
- **Failed run, kept:** one full E2E run failed 2 walking tests in `rooms.spec.ts` while the machine's load average was about 20 (`uptime` showed 20.90 over 15 minutes right after it). The output was saved before re-running. The same specs passed alone, and the next full run passed 29 of 29.

### Results (see `docs/evidence/`, 2026-11-10)
| Command | Result |
| --- | --- |
| `pnpm typecheck` | exit 0 |
| `pnpm test:unit` | shared 13 files / 136 tests, web 1 file / 8 tests |
| `pnpm test:server` | 11 files, 90 tests |
| `pnpm build` | exit 0; web JS 1,479 kB (406 kB gzip) |
| `pnpm exec playwright test` | first run: 27 passed, 2 failed (kept in `test-e2e-failed-under-load-2026-11-10.txt`); re-run: 29 passed (8.3 min) |
| `pnpm test:prod` | 1 passed |

New screenshots: `desktop-pairs-board.png`, `desktop-pairs-podium.png`, `phone-pairs-board.png`.

### Session 4, continued: running the app for the owner

- **Prompt (owner):** "run the app first, I want to try it", then "how confident are you that we win?".
- **Hosting:** the owner said he has his own VPS. Kiro had kept offering Neon and Render as if they were decided. The owner asked why, and Kiro answered that it was its own tentative plan from session 1, never confirmed by the owner. VPS details are pending.
- **Stale server:** port 2590 was held by a Ghostel server running the pre-M16 build (PID 27722, started 2026-11-09 20:25). Kiro stopped it with `SIGTERM` so the owner would try the current code, and said so.
- **`pnpm dev`:** the agent shell refused to run it directly ("appears to be a development server command"). Kiro started it detached with `nohup`, with a log in `/tmp/ghostel-dev.log`.
  - Vite reported "ready" on http://127.0.0.1:5290, and the server reported "ready" on http://127.0.0.1:2590.
  - `curl http://127.0.0.1:5290/api/health` through the Vite proxy returned `HTTP/1.1 200 OK` and `{"ok":true}`.
  - The dev database's latest migration is `006_monster_pairs`, and house rooms are 1A `pumpkin_trivia`, 1B `monster_pairs`, 1C `none`.
  - A throwaway headless Chromium script (not saved in the repo) checked in as "Smoke Tester" at http://localhost:5290. It printed `status: Live`, `place: Grand Lobby`, `page errors: 0`. This closes HANDOFF item 0. The script created one guest, "Smoke Tester", in the dev database.

### Session 4, continued: reading the rules and judging criteria

- **Prompt (owner):** "now try to read the official rules and judging criteria".
- **Result:**
  - `https://kiroween.devpost.com/rules` returned HTTP 403 again.
  - A web search found the AWS Japan blog post about Kiroween 2026 (https://aws.amazon.com/jp/blogs/news/kiroween-2026/). The post says it summarises the official Devpost overview and Official Rules as of 2026-10-31 and that the English pages are authoritative.
  - Kiro read it in full and recorded an English paraphrase in `.kiro/steering/submission.md`: dates, eligibility, submission items, prizes and the five judging criteria (20% each).
- **New facts that change plans:**
  - The judging criteria are Potential Impact, Technological Implementation, Design, Innovation/Idea and Presentation, each 20%.
  - The Kiro write-up topics include custom agents, MCP, property-based testing and Kiro powers. Ghostel has not used these.
  - Free Kiro credits must be requested by 2026-12-01 12:00 PT.
  - A Bonus Blog Prize and a Social Blitz prize exist.
  - Some countries are excluded. The owner has to check Indonesia in the official text.
- M15 task 7 stays open: the official English text has still not been read directly.

## Session 4, continued — 2026-11-10/11: Milestone 18 (brighter lighting)

- **Prompt (owner):** "make Ghostel's lighting a little brighter, it is too dark".
- **Spec first:** `.kiro/specs/m18-brighter-lighting/`. Kiro measured before changing anything: it wrote `scripts/measure-brightness.mjs` (the mean luma of a PNG via Playwright's Chromium, because the machine's Python has no PIL) and stored the baseline.
- **Agent mistake caught:** the first evidence file recorded `$?` after an `echo`, so its exit code line was meaningless. This is the same error as in session 1. Kiro re-recorded it, capturing the exit code right after the command.
- **Iterations, all measured or traced:**
  1. Exposure 1.15, later fog, more ambient and hemisphere light, and warm point lights in the lobby and the rooms. The rooms got brighter, but the 2B room E2E test hit its 90 s timeout. A Playwright trace showed a chat `Fill` taking 9.5 s and a `Press` taking 20 s. Kiro removed the extra point lights.
  2. The phone lobby screenshot was unchanged (8.0 → 8.2), because the phone camera looks mostly at the nearly black floor. Kiro made the lobby floor checker lighter, and it went to 27.0.
  3. A screenshot tool returned a cached copy of a re-taken PNG, so Kiro copied the file under a new name to look at it.
- **Flaky E2E, not fixed:**
  - The 2B door walk in `rooms.spec.ts` failed in several runs. Load averages were 19 to 97, from macOS storage scanning processes running for 1–2 days.
  - Kiro tried waiting for the elevator prompt, and later a step-by-step walk helper. Neither helped, and the step helper did worse, so both were reverted. The spec is back to its original code.
  - The stored full run is 28 passed and 1 failed. A re-run on a quieter machine is needed before calling M18 fully verified.
- **Re-run:** at 09:30 the load average dropped to 2.6. A full E2E run started at 09:33 (load 2.9) passed 29 of 29 (exit 0) without any test change. The production smoke test passed afterwards. M18 is done.

### Results (see `docs/evidence/`, 2026-11-11)
| Command | Result |
| --- | --- |
| `pnpm typecheck` | exit 0 |
| `pnpm test:unit` | 136 shared + 8 web |
| `pnpm test:server` | 90 passed |
| `pnpm build` | exit 0 |
| `pnpm exec playwright test` | 29 passed (7.5 min) |
| `pnpm test:prod` | 1 passed |
| `scripts/measure-brightness.mjs` | `brightness-before-m18.txt`, `brightness-after-m18.txt` |

### Session 4, continued — 2026-11-12: VPS sizing from measurements

- **Prompt (owner):** "give me the VPS specs for hosting this app". The owner had said earlier that he has his own VPS.
- **Measured on this machine (Apple M1):**
  - `pnpm build` peak resident memory 417 MB (`/usr/bin/time -l`), 3.5 s.
  - `apps/web/dist` 4.5 MB on disk. First load without pdf.js: JS, CSS and HTML are 411 kB gzipped against 1.5 MB raw. The server does not compress, so the reverse proxy should.
  - PostgreSQL container 107 MiB, dev database 7.9 MB.
- **New script:** `scripts/load-probe.mjs` starts the built server on port 2597 against `ghostel_test`. It connects N real WebSocket guests (cookie and Origin as in the browser) that walk the lobby at 20 Hz while one chats every second, and samples the server's RSS and CPU. The output is in `docs/evidence/load-probe.txt`:
  - 30 guests in one lobby: server RSS max 103 MB, CPU about 4% of one core, about 116 kbit/s to each guest (3.5 Mbit/s in total).
  - 60 guests in one lobby: RSS max 105 MB, CPU about 5%, about 228 kbit/s per guest (13.7 Mbit/s in total). Traffic per guest grows with the number of guests in the same scene.
- The owner first rejected the evidence run, then approved it ("lanjut approve").
- Not measured: WebRTC media. It is peer-to-peer and does not pass through the server unless a TURN relay is added.

## Session 4, continued — 2026-11-12: Milestone 19 (smoother frame rate)

- **Prompt (owner):** "the app lags a bit, can you make it smoother?"
- **Measured before changing anything:**
  - Kiro wrote `scripts/perf-probe.mjs`. It records fps, frame-time percentiles, Chrome DevTools Protocol main-thread metrics, an optional JS CPU profile (`PROFILE=1`) and a WebGL draw-call counter injected as test-only instrumentation.
  - On Retina, the lobby ran at 35 fps with a 50 ms 95th-percentile frame and 450 draws per frame. At scale 1 every scene ran at 60 fps.
  - The JS profile showed mostly three.js per-object work. Movement snapshots do not cause React re-renders (positions are mutated in place).
- **Spec:** `.kiro/specs/m19-smoother/`, written before the code. Every step was measured, and the table is in `tasks.md`.
- **What helped most:** removing three point lights (39 → 56 fps). The pixel ratio cap and `PerformanceMonitor` brought the other floors to 57–60 fps. Merging 14 static props cut draws by 12%.
- **Agent pitfalls seen again:**
  - Edits to the same file in one parallel batch made `read_file` and `grep` results look stale. Kiro re-checked the file with `grep` before trusting it.
  - The image reader returned an earlier copy of a re-taken screenshot, so Kiro copied the file under a new name to view it.
- **Environment:** load spikes up to 171 (`airportd` about 118% CPU, plus macOS storage scanning) broke one full E2E run and one probe run. Both outputs are kept as failed evidence. The re-runs at low load passed.

## Session 4, continued — 2026-11-12: Milestone 20 (room meetings at the long table)

- **Prompt (owner, with a screenshot of a standing guest in room 1C who still had mic, camera and "Ask to present"):** sitting at the meeting table should open the Zoom-like page and standing should leave it; a standing guest can still present, fix that first.
- **Kiro's reading:** this is a product and security rule change, not only UI. The server put everyone in a room into one call and sent presentations to the whole room. Kiro changed the rule in steering first (`product.md`, `security.md`, `architecture.md`), marked M12 and M14 as superseded in part, and wrote the M20 spec before the code.
- **Subagent:** a `context-gatherer` run mapped every place the old rule lived: hub call keys, presentation checks and delivery, slide authorization, web wiring, the affected tests, and the docs.
- **Server:**
  - The call key is now `<channel>#<table>` everywhere, including rooms.
  - Presentations, requests and slides are limited to the meeting.
  - Joining the meeting sends the current presentation, and leaving it ends your request and presentation.
  - A standing guest who asks to present gets a notice rather than an "invalid" count, because a click can race the seat update.
- **Agent mistakes, recorded as they happened:**
  1. Kiro again put two edits to the same file in one parallel batch. It checked with `grep` each time before continuing, and then switched to one edit per step for `hub.ts`.
  2. Kiro ran `pnpm test:server` and `pnpm build` while a full E2E run was going. The build rewrote `dist/` under the running test server, so that run is invalid. It is kept as `test-e2e-invalid-overlapping-build-2026-11-12.txt` and was not counted.
- **Results:** see the M20 `tasks.md`. In short:
  - Unit, integration (91), build and production smoke test pass.
  - The last full E2E run had 3 failures while the load rose to 39. The failed specs passed 5 of 5 when re-run alone.
  - No single full E2E run has passed since M20.
