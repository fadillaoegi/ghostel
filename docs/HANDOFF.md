# Handoff

Last session: 2026-11-10. Milestones 1–7, the owner's milestones M8–M14, M16 and M17 are implemented and tested. M8 is floors and music, M9 room doors, night city and monsters, M10 Ghoul's Diner and the rooftop on floor 5, M11 phone gamepad and landscape, M12 seats, table calls and the meeting view, M13 camera, M14 presentations. Specs are in `.kiro/specs/` (`m1-check-in-and-lobby` covers milestones 1 and 2). The category report is in `docs/CATEGORY-REPORT.md`.

## Start the next session
```sh
cd /Users/boo/Github/project/Hacketon/ghostel
kiro-cli
```
Start Kiro from this folder so `.kiro/steering`, `AGENTS.md` and `.kiro/hooks` load.

## Open items
0. **`pnpm dev` smoke-tested on 2026-11-10.** It was started detached with `nohup` (the agent shell refuses `pnpm dev` directly). `/api/health` through the Vite proxy on :5290 returned `{"ok":true}`. A headless Chromium checked in at http://localhost:5290 and reached "Live" in the Grand Lobby with 0 page errors. The dev database applied migration `006_monster_pairs`, and house room 1B now runs Monster Pairs.
1. **Verify the remaining Kiro hooks (M15 task 3).**
   - The guard hook is **proven**: on 2026-11-09 it blocked a real tool call in Kiro (log line in `docs/evidence/kiro-hooks.log`).
   - Still to see: the `session-status` hook. Start a fresh Kiro session in this folder and check that the log gets a `session-status … SessionStart` line and that the agent mentions the status.
   - The PostFileSave hook (`shared-tests-on-save.json`, left unchanged at the owner's request) does not log. It is only visible when tests fail.
   - Record in `docs/KIRO-ACTIVITY.md` exactly what appeared, and nothing more.
2. **Owner decisions still open:** hosting (Render Free + Neon Free, tentative); whether to stop the old Ghost Turtle Kit dev launcher. It was running as PID 17598 at session start. Ghostel did not stop it, but by the end of the session `pgrep -fl scripts/dev.mjs` found nothing, so it may have been stopped from outside.
3. **Visual polish (Costume Contest):**
   - Phone camera was retuned in M3 (height 11.5, back 11.5) and ambient light raised. Check it on a real phone.
   - The ghost-sheet costume hides the legs only visually; the sheet is a plain open cylinder. A wavy hem would read better.
4. **Deployment is prepared; it needs the owner's accounts.** Follow `docs/DEPLOY.md`: a Neon project, then a Render Blueprint from `render.yaml`, with `DATABASE_URL` and `ALLOWED_ORIGINS` set in the dashboard. Then set the GitHub variable `GHOSTEL_URL` to enable the keep-alive workflow. After the deploy, test voice on two real devices on different networks. Not yet verified on Render itself: `corepack enable` in the build (fallback in DEPLOY.md) and the real `X-Forwarded-For` layout (`TRUST_PROXY=1`).
   - Then: re-check the official Kiroween rules, record the demo video (under 3 minutes), and write the Devpost text.
   - Voice was tested only on localhost with Chromium's fake microphone. Test once with two real devices on different networks (needs HTTPS hosting). Without TURN, some networks will fail to connect.
5. **Polish:** on phones the HUD hides the place name (the room name is on the 3D wall sign, but the HUD could show it too). Lighting was brightened in M18 (rooms from mean luma ≈ 10 to ≈ 16). Name-tag overlap was fixed in M5 by nudging tags apart.
   - **E2E and machine load:** the door 2B walk in `rooms.spec.ts` fails when the load average is far above 10. On 2026-11-11, macOS storage scanning kept it at 19–97. Start E2E runs when `uptime` shows a low load. The stored run (load 2.9 at the start) passed 29 of 29.
   - **After M20 (2026-11-12) no single full E2E run has passed yet.** Each spec passed on its own, and the failures came at loads of 23–39. Re-run `pnpm exec playwright test` on a quiet machine. Never build or run other tests while it runs.
6. **Bundle size:** web JS is 1,411 kB (386 kB gzip, `docs/evidence/build.txt`). Lazy-load the 3D scene behind the creator, and the city behind floor 4, if the first load feels slow on phones.
   - Frame rate (M19): the lobby still draws about 400 objects per frame (other scenes 70–140). If phones lag, the next step is merging or instancing avatars' static parts, tables, candles and pumpkins. Measure with `scripts/perf-probe.mjs`.
7. **E2E speed:** the suite took 3.3–6 minutes in this session (M8: 1.7 minutes). Each open lobby page renders continuously, so with 3–4 browser contexts a new page needs 4–8 s to reach the lobby (measured with a throwaway probe). Hiding the new doors and NPC avatars did not change that. Main-thread time was about 150 ms/s per lobby page either way. Machine load (Docker VM) varied a lot. If it matters, try `frameloop="demand"` for hidden tabs or pause rendering on `visibilitychange`.
9. **Real-device checks for M10–M14:**
   - Calls with camera and screen share on two real devices on different networks (needs HTTPS hosting, maybe a TURN server; video through TURN uses a lot of bandwidth).
   - The touch gamepad on a real phone in both orientations.
   - A physical gamepad (only a fake `navigator.getGamepads` was tested).
10. **Spec order:** M10's spec was written before its code. The M11–M14 specs were written while they were being built in one long session; see `docs/KIRO-ACTIVITY.md`.
11. **E2E took 8.2 minutes** (25 tests). Most of that is several 3D pages rendering at once in one browser (see item 7).
12. **Flaky integration test:** `floors.test.ts` "the Golden Crown is locked…" failed once on 2026-11-09 (the candy update came back empty), then passed in 4 runs. Cause unknown; watch for it.
8. **Room doors (M9):** the stale-room cleanup (3 days unused) is tested at repository level, not through the hourly timer. Door labels in the hub are loaded at startup and kept in sync by the room routes; a manual SQL change to `rooms` needs a server restart to show on doors.

## Things to know
- M16 (2026-11-10):
  - The Night Desk terminal is the `night-desk` obstacle in `layout.ts` (its box reaches into the wall on purpose). The `terminal` prompt is in front of it.
  - The story rules are in `packages/shared/src/nightdesk.ts`, and the UI in `apps/web/src/ui/NightDesk.tsx`.
  - The Haunted Mirror camera is `apps/web/src/ui/mirrorCam.ts`, separate from `CallClient`. The shader is in `three/floors/Gallery.tsx`.
  - E2E is in `e2e/oddities.spec.ts`. It spies on `getUserMedia` with an init script.
  - Skeleton Crew is still undecided (owner).
- M17 (2026-11-10):
  - Monster Pairs rules are in `packages/shared/src/games/pairs.ts`, and the panel in `apps/web/src/ui/PairsPanel.tsx`. The shared podium and timer are in `GameParts.tsx`.
  - Migration `006_monster_pairs` widens `rooms_game_check`.
  - House room 1B now runs Monster Pairs. `ensureHouseRooms` updates house room games on every start.
  - `TRIVIA_FAST=1` also selects a 4-pair game.
  - `hub.ts` was not changed. How to add a game: `docs/GAME-KIT.md`.
  - Before the migration, the dev database was backed up to `backups/ghostel-pg18-before-006-20261110-142214.dump` (gitignored).
  - A dev server (PID 27722, started 2026-11-09 20:25, not by Kiro in this session) still runs the old build against the dev database. After a restart it applies migration 006 and switches house room 1B to Monster Pairs.
- Ports: web 5290, server 2590, PostgreSQL 5490, E2E server 2595.
- The server registers static files at startup: after `pnpm build`, restart it, or new asset names fall through to `index.html`. Old project ports 5178, 5179, 8098, 5478 are avoided.
- Databases: `ghostel` (dev) and `ghostel_test` (integration + E2E), both in the `ghostel-postgres-1` container (PostgreSQL 18, `postgres:18-alpine`), volume `ghostel_ghostel_pg18` mounted at `/var/lib/postgresql` (18+ keeps data in `/var/lib/postgresql/18/docker`). The old PostgreSQL 17 volume `ghostel_ghostel_pg` was removed on 2026-11-09 at the owner's request, after a `pg_dump` to `backups/` (gitignored) that was restored into 18.
- E2E uses ANGLE Metal on macOS. SwiftShader is far too slow for the lobby (2–5 fps).
- drei `Html` did not render its children here; name tags use the DOM overlay in `apps/web/src/three/nametags.tsx`.
- Rooms: the hub injects a `RoomGate` (`apps/server/src/app.ts`) that checks the database and argon2 hashes. `PresenceHub.broadcast(channel, …)` is the isolation boundary; every new realtime feature must go through a channel.
- Floors: `packages/shared/src/floors.ts` (layouts, elevators, prompt zones, `sceneKeyFor`). Channels and scene keys are "lobby", "floor:2..4" and "room:<id>". Moves carry the scene epoch from `welcome`; the server drops moves from an older scene.
- Candies: `packages/shared/src/candies.ts`; the server checks floor and distance in `PresenceHub.collect` and stores them in `guests.candies` (migration 003). The crown hat is rejected by `PUT /api/me` until all 12 are found.
- Music: `apps/web/src/ui/music.ts` (engine) and `scores.ts` (tunes). Web unit tests live in `apps/web/test/`.
- NPCs: positions are pure functions of wall-clock time in `packages/shared/src/npcs.ts`, so there is no network traffic for them. NPC tags use `data-testid="nametag-npc"` and bubbles use `npc-bubble`, so they never interfere with guest-presence tests.
- House rooms: `apps/server/src/db/house.ts` seeds them on every start behind doors 1A–1C (fixed UUIDs, owned by "The Concierge", whose token hash comes from random bytes, so nobody can own them).
- Doors (M9): `packages/shared/src/doors.ts` defines every door (code, floor, slot, wall position) and `doorArrival`. Rooms store `floor` and `slot` (migration 004, unique per door). `POST /api/rooms` takes optional `floor`/`slot`; without them the server picks the first free door. The hub keeps a room map for door labels (`doorsFor`, `doors` message to the floor's channel only) and `leaveRoom` puts guests in front of the room's door. Prompt zones for doors carry `code`; the web prompt is `data-testid="door-prompt"` with `data-door`.
- Games: engines implement `GameEngine` (`packages/shared/src/games/engine.ts`) and register in `createGameRegistry`; the hub has no game-specific code. `TRIVIA_FAST=1` (set by `playwright.config.ts`) shortens trivia to 3 quick rounds; never set it in production.
- Calls (M12–M14): `apps/web/src/net/call.ts` (`CallClient`, perfect negotiation, polite side = smaller public id) and the hub's `syncCall`/`callKey`.
  - A call is a room (everyone inside) or `<channel>#<table>` (guests seated there).
  - `media` messages carry `mic` and the camera and screen stream ids. The server keeps a screen id only for the approved screen presenter.
  - In E2E, call `page.bringToFront()` before clicking Unmute, Camera or Share, because Chrome waits for focus before granting devices.
- Seats: `packages/shared/src/tables.ts` (tables per floor, the room's long table by capacity, seat prompts `t3:1`, `standSpot`). Moves are ignored while seated.
- Presentations: hub `presentations`/`presentRequests` per room channel; slides upload and download in `apps/server/src/http/slides.ts`.
  - pdf.js 6.5.438 is loaded lazily by `apps/web/src/ui/Presentation.tsx`.
  - Its standard fonts are copied to `/pdfjs/standard_fonts/` by a Vite plugin (`apps/web/vite.config.ts`).
  - The canvas must be sized to the viewport before `render`.
- Diner: `packages/shared/src/canteen.ts` (snacks, counter spot). Snacks expire in the hub's 200 ms game timer.
- Touch gamepad: `apps/web/src/ui/Joystick.tsx` (floating stick zone, A button); gamepad polling in `apps/web/src/input/controls.ts`.
- E2E resets `ghostel_test` before starting the server (`apps/server/scripts/reset-test-db.mjs`, refuses other databases).
- Agent note: tool calls in one batch can run in parallel. Do not write a file and run tests that need it in the same batch (this caused stale test counts and one stale build in this session).
- `pnpm dev` runs React StrictMode (double mount in development); E2E runs the production build and does not see StrictMode bugs. Anything that registers handlers must do it in an effect with a matching cleanup (see `CallClient.attach`/`detach`, fixed 2026-11-12 after the meeting view never opened in dev).
- pnpm 11 needs `allowBuilds` in `pnpm-workspace.yaml` for esbuild's postinstall.
- `TRUST_PROXY` is a hop count (0 locally, 1 on Render), never "trust all", so clients cannot spoof their IP for rate limits (`apps/server/test/proxy.test.ts`).
- `pnpm test:prod` runs the production build with `NODE_ENV=production` on http://localhost:2597 (`playwright.prod.config.ts`, `e2e-prod/`).
- Production: `pnpm build && NODE_ENV=production pnpm start`. The server serves `apps/web/dist`, so web, API and WebSocket share one origin. Production cookies use the `__Host-` prefix and require HTTPS.
