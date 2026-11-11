# Progress

| # | Milestone | Status |
| --- | --- | --- |
| 1 | Low-poly character creation and guest name | Done 2026-11-07 |
| 2 | Explorable building, other guests visible in realtime | Done 2026-11-07 (Grand Lobby only) |
| 3 | Chat in the central hall | Done 2026-11-07 |
| 4 | Rooms: create, lock, password (checked on server) | Done 2026-11-07 |
| 5 | Voice inside rooms | Done 2026-11-07 |
| 6 | One polished shared game (Pumpkin Trivia, confirmed) + game system | Done 2026-11-07 |
| 7 | Decoration, atmosphere, NPC ghosts | Done 2026-11-07 |
| 8 | Second game or proximity voice | Not started (replaced for now by the owner's requests: floors and music in M8, doors, city and monsters in M9) |
| M16 | Haunted Mirror and Night Desk terminal | Done 2026-11-10 |
| M17 | Ghostel Game Kit and Monster Pairs (also covers milestone 8's "second game") | Done 2026-11-10 |

## 2026-11-07 — Milestone 1 (spec `m1-check-in-and-lobby`)
Owner-defined acceptance criteria and their evidence:

| Criterion | Evidence |
| --- | --- |
| Reload keeps name and look | `session.test.ts` "keeps name and look after a reload"; E2E reloads Bob and checks name, head and hat |
| Two guests cannot change each other's profile | `session.test.ts` "two guests cannot change each other's profile" (also forged token) |
| Position cannot leave the building with fake values | `movement.test.ts` grid sweep + teleport/NaN tests; `presence.test.ts` "never lets a fake position leave the building" |
| Invalid name rejected by server with a clear message | `session.test.ts` profile validation; E2E calls the API directly and checks the 400 message |
| Looks good on desktop and phone | `docs/evidence/screenshots/` (reviewed by eye, see HANDOFF for known visual issues) |

Check results (from `docs/evidence/*.txt`, all exit code 0): typecheck, 43 unit tests, 24 server integration tests, build, 3 Playwright tests.

## 2026-11-07 — Milestone 3 (spec `m3-lobby-chat`)

| Criterion | Evidence |
| --- | --- |
| A message appears in the other guest's log and as a bubble above the sender | `e2e/chat.spec.ts` "guests chat in the lobby with speech bubbles"; `chat.test.ts` broadcast test |
| Empty, too-long and flooded messages are rejected and never reach others | `chat.test.ts` (invalid, rate limit across two tabs, forged sender); E2E flood test |
| Rename changes new messages only | `chat.test.ts` "uses the new name for new messages only" |
| Late joiner sees recent history | `chat.test.ts` + E2E "Late Lantern" |
| Desktop and phone | `docs/evidence/screenshots/desktop-lobby-chat.png`, `phone-lobby-bubble.png`, `phone-chat-sheet.png` |

Check results (all exit code 0): typecheck, 53 unit tests, 30 server integration tests, build, 6 Playwright tests.

## 2026-11-07 — Milestone 4 (spec `m4-rooms`)

| Criterion | Evidence |
| --- | --- |
| A password never appears in API responses, WebSocket messages or browser storage | `rooms.test.ts` "creates and lists rooms without ever exposing…" and "password rooms…" (checks every server message); E2E checks localStorage, sessionStorage and cookies |
| Wrong passwords never let a guest in; guessing is throttled | `rooms.test.ts` "password rooms: required, wrong, right, and throttled guessing"; E2E wrong-then-right flow |
| Guests outside a room cannot read its chat or see its occupants move | `rooms.test.ts` "isolates chat and movement…"; E2E: Larry in the lobby never sees the room chat or room nametags |
| Only the owner can rename, re-lock or delete | `rooms.test.ts` "only the owner can change or delete a room" (403/404) |
| Desktop and phone | `docs/evidence/screenshots/desktop-room-*.png`, `desktop-door-prompt.png`, `phone-create-room.png`, `phone-room-ballroom.png` |

Stored hashes are argon2id (`$argon2id$v=19$m=19456,t=2,p=1$…`). Check results (all exit code 0): typecheck, 67 unit tests, 43 server integration tests, build, 8 Playwright tests.

## 2026-11-07 — Milestone 5 (spec `m5-voice`)

| Criterion | Evidence |
| --- | --- |
| Two guests in a room hear each other | `e2e/voice.spec.ts`: WebRTC connects ("1 connected" on both sides) and each side detects the other's fake-microphone beep (`data-voice="speaking"`) |
| Lobby and other rooms never receive signaling or mute states | `voice.test.ts` "relays signals only between call members…", "shares mute state with the room only" |
| In the room but not in the call: cannot signal the call | `voice.test.ts` (listener case) |
| Leaving the room ends that guest's call | `voice.test.ts` "leaving the room, closing the tab or deleting the room ends the call"; E2E "Back to lobby" drops the peer and its audio element |

Check results (all exit code 0): typecheck, 73 unit tests, 51 server integration tests, build, 9 Playwright tests. Voice was verified only on localhost with a fake microphone.

## 2026-11-07 — Milestone 6 (spec `m6-pumpkin-trivia`)

| Criterion | Evidence |
| --- | --- |
| A solo guest plays a full game against the bot and reaches the podium | `e2e/trivia.spec.ts` solo test (3 fast rounds, podium, Play again); `games.test.ts` solo full game |
| Two guests see the same question and the same results | `e2e/trivia.spec.ts` two-player test (desktop + phone); `games.test.ts` two players |
| No message during a question contains the correct answer | `trivia.test.ts` "never reveals…"; `games.test.ts` checks every question-phase message for `correct`, `picks`, `gained` |
| Wrong-round, second and spectator answers are ignored | `trivia.test.ts` "accepts one answer per player and round…"; `games.test.ts` late spectator |
| Desktop and phone | `docs/evidence/screenshots/desktop-trivia-*.png`, `phone-trivia-*.png` |

Check results (all exit code 0): typecheck, 86 unit tests, 57 server integration tests, build, 11 Playwright tests.

## 2026-11-07 — Milestone 7 (spec `m7-atmosphere`)

| Criterion | Evidence |
| --- | --- |
| A first-time solo visitor sees moving ghosts, is greeted by name and finds rooms right away | `e2e/atmosphere.spec.ts` (4 NPC tags, Wisp moves, Mortimer's greeting with the guest's name, 3 house rooms, The Host in Pumpkin Trivia Hall) |
| NPC tags never count as guests | Same test checks "1 guest haunting" and zero guest name tags; all earlier presence tests still pass |
| House rooms cannot be changed by any guest | `house.test.ts` (403 on PATCH and DELETE, seeding idempotent) |
| NPCs stay inside the walls | `npcs.test.ts` (every path sampled every 0.25 s for 10 minutes) |

Check results (all exit code 0): typecheck, 91 unit tests, 60 server integration tests, build, 13 Playwright tests.

## 2026-11-07 — Deployment preparation (no deploy yet: needs the owner's Render and Neon accounts)
- `render.yaml` (Blueprint), `.node-version`, `.github/workflows/keep-alive.yml`, `docs/DEPLOY.md`.
- `TRUST_PROXY` became a hop count. A test shows that a forged `X-Forwarded-For` header cannot dodge rate limits.
- `pnpm test:prod`: the production build with `NODE_ENV=production` passes: `__Host-` Secure HttpOnly cookie, CSP and security headers, no console or CSP errors, cache headers, SPA fallback.
- The Render build command was simulated from a clean copy of the repo with `NODE_ENV=production` in the environment: install and build succeeded.

## 2026-11-08 — Milestone 8: floors, music, candy hunt (spec `m8-floors-and-music`, owner request)

| Criterion | Evidence |
| --- | --- |
| Changing floors changes the scene, the guests, the chat and the music | `e2e/floors.spec.ts` (place names, NPCs, floor chat not seen in the lobby); `floors.test.ts` (channel isolation); `themeFor` unit test |
| A candy cannot be collected from another floor or from far away, even with a forged message | `floors.test.ts` "refuses candies that are far away or on another floor", "unknown candy ids count as invalid" |
| The crown is locked until 12/12, then selectable | `floors.test.ts` crown test; E2E sees the locked crown chip |
| All earlier tests still pass | full runs in `docs/evidence/` |

Check results (all exit code 0): typecheck, 100 shared + 7 web unit tests, 69 server integration tests, build, 16 Playwright tests, production smoke test.

## 2026-11-08 — Milestone 9: monster variety, night city, room doors (spec `m9-monsters-city-doors`, owner request)

Owner request: rooms reachable on floors 2 and 3 so guests can arrange to meet "on floor 2, room B"; a city at night visible below the rooftop; more ghost and monster variety for NPCs and in the character creator. The agent proposed door codes (1A–1D lobby with the house rooms in 1A–1C, 2A–2F, 3A–3D, walk up and press E) and the owner agreed.

| Criterion | Evidence |
| --- | --- |
| Every room has exactly one door code; taken doors and full floors are refused | `apps/server/test/doors.test.ts` (first free door, requested door, 409 `door_taken` / `floor_full`, unknown doors, rooms cannot move, delete frees the door, unique constraint) |
| Door labels are live and reach only guests on that floor | `doors.test.ts` "door labels reach only the guests on that floor, live" |
| Leaving a room puts you in front of its door | `doors.test.ts` exit test; `e2e/rooms.spec.ts` (Vic and Finn step out at 2B / 3B) |
| Meeting at a door code works in the browser | `e2e/rooms.spec.ts`: Olga books 2B, Larry rides to floor 2, walks to 2B, sees "Press E to enter 2B · Witching Hour", gets the password prompt, later the locked toast; floor 3 test books vacant door 3B with E and a friend walks in |
| Existing rooms get doors when the migration runs (house rooms first) | `doors.test.ts` "migration 004_room_doors" (19 rooms, 14 doors, oldest kept) |
| Unused guest rooms are released, house and occupied rooms never | `doors.test.ts` releaseStale test |
| New monster parts are accepted by the server and saved | `e2e/lobby.spec.ts` "monster costume parts are saved by the server…" (vampire, pirate, bat wings, then werewolf and fur, kept after reload) |
| NPC variety on every floor | `e2e/atmosphere.spec.ts` (5 lobby NPCs), `e2e/floors.spec.ts` (two NPCs per upper floor); `npcs.test.ts` and `floors.test.ts` keep every NPC path inside the walls |
| Night city under the rooftop | screenshot `docs/evidence/screenshots/desktop-floor4-rooftop.png` (visual only, no automated assertion) |

Check results (all exit code 0): typecheck, 104 shared + 7 web unit tests, 80 server integration tests, build, 18 Playwright tests, production smoke test.

Test changes worth knowing: E2E walks to a door now hold the key until the door prompt shows (instead of a fixed time), and `TRIVIA_FAST` questions last 12 s instead of 6 s. Both failed once on a busy machine, where slow frames (dt clamped to 0.1 s) cover less ground.

## 2026-11-08/09 — Milestones 10–14 (owner requests)

Owner requests, in Indonesian, summarised:
- A canteen on floor 4 with many tables to chat at, and the rooftop moved to floor 5.
- Responsive phone play in portrait and landscape, with an analog stick like a gamepad.
- Presentations in rooms like Zoom: both screen sharing and PDF slides, everyone may present with the room owner's approval.
- Open the camera.
- A long table in every room with as many seats as the member count chosen at creation.
- Tables for 2 and 4 on every floor; sitting at one connects you to whoever sits there, in a Zoom-like view.

Confirmed choices: rooms hold 2–8 guests; mic and camera off until clicked; one call per room, one call per floor table. The owner also agreed that the "no video" product rule changes (now in `product.md` and `security.md`).

| Milestone | Spec | Evidence |
| --- | --- | --- |
| M10 Ghoul's Diner (floor 4), rooftop on floor 5 | `m10-canteen-and-rooftop` | `tables.test.ts`, `floors.test.ts` (five floors, walkable tables, candies, NPCs); server `floors.test.ts` "Ghoul's Diner" (order at the counter only, cooldown, unknown snack invalid, expiry, other floors never see it); `e2e/diner.spec.ts`; screenshots `desktop-floor4-diner.png`, `desktop-diner-menu.png`, `desktop-diner-snack.png`, `desktop-floor5-rooftop.png` |
| M11 phone gamepad, landscape, physical gamepads | `m11-mobile-gamepad` | `e2e/mobile.spec.ts` (portrait action button, landscape fit checks and stick movement, fake gamepad A/B); screenshots `phone-gamepad-portrait.png`, `phone-landscape-*.png` |
| M12 seats, table calls, meeting view, room capacity | `m12-seats-and-meetings` | server `calls.test.ts` (reach, taken chair, invalid table, call membership and isolation, media, disconnect/elevator, room call and capacity, SDP limit); `rooms.test.ts` capacity rules; shared seat tests; `e2e/voice.spec.ts` (real audio between two browsers, meeting view), Diner table test; screenshots `desktop-meeting-room.png`, `desktop-meeting-table.png` |
| M13 camera | `m13-camera` | `e2e/voice.spec.ts` (fake camera shown in the other guest's tile with a non-zero video width; no video elements after leaving) |
| M14 presentations | `m14-presentation` | server `presentations.test.ts` (approval rules, screen only for the approved presenter, upload 403/415/413, download only inside the room, page turns, cleanup, Origin); `e2e/present.spec.ts` (PDF slides with approval and page turns; screen share seen live); screenshots `desktop-present-request.png`, `desktop-present-slides.png`, `desktop-present-screen.png` |

Check results, run in order on 2026-11-09 (all exit code 0):
- typecheck
- 116 shared + 8 web unit tests
- 87 server integration tests
- build
- 25 Playwright tests (8.2 min)
- production smoke test

Not verified: calls, camera and screen sharing between two real devices on different networks (needs HTTPS hosting, maybe TURN); the physical gamepad on real hardware (tested with a fake `navigator.getGamepads`); the layout on a real phone.

## 2026-11-10 — Milestone 16: the Haunted Mirror and the Night Desk (spec `m16-mirror-and-night-desk`, owner request)

Owner request: stay in Costume Contest, but add parts that echo the other categories. Start with Frankenstein and Resurrection; decide on Skeleton Crew later.

| Criterion | Evidence |
| --- | --- |
| The mirror asks for the camera only after a click, video only | `e2e/oddities.spec.ts` (a `getUserMedia` spy records no stream before the click, then exactly one stream with 1 video and 0 audio tracks) |
| The mirror's camera stops when the guest walks away or clicks again | Same test: every recorded track is `ended` after walking away, and again after an on/off click |
| The mirror stream never reaches a call or the server | By design: `apps/web/src/ui/mirrorCam.ts` does not import `CallClient`, and the guest is not in a call. No automated network check. |
| The terminal is an obstacle with a walkable prompt; NPCs, candies and other prompts unaffected | `packages/shared/test/nightdesk.test.ts`; existing `tables.test.ts`, `npcs.test.ts` and the `movement.test.ts` grid sweep (which caught a wall-side push-out problem; fixed by extending the desk box into the wall) |
| The story can be finished; locked door, ledger and input limits work | `nightdesk.test.ts` (12 tests); E2E plays it to "CHECKOUT COMPLETE … 11 MOVES" |
| Typing in the terminal does not move the avatar | E2E: after N/S/E/W commands and Escape the terminal prompt is still shown |
| Looks right | Screenshots `desktop-night-desk-lobby.png`, `desktop-night-desk.png`, `desktop-mirror-camera.png` (reviewed; the desk and screen were enlarged after the first review) |

Check results, run in order on 2026-11-10 (all exit code 0):
- typecheck
- 128 shared + 8 web unit tests
- 87 server integration tests
- build (web JS 1,473 kB, 405 kB gzip)
- 27 Playwright tests (2.7 min)
- production smoke test

Not verified: the mirror with a real camera (only Chromium's fake camera); the terminal on a real phone keyboard.

## 2026-11-10/11 — Milestone 18: brighter lighting (spec `m18-brighter-lighting`, owner request "too dark")

- **What changed:**
  - Renderer exposure went to 1.15. Signs and screens are `toneMapped={false}`, so they keep their glow.
  - The fog now starts later (20–60 instead of 16–46).
  - Ambient and hemisphere light went up in the lobby, rooms, gallery, greenhouse and rooftop.
  - The lobby floor checker is lighter.
  - No new point lights. A first version with two extra point lights slowed the browser tests, so they were removed (see `tasks.md`).
- **Measured:** `scripts/measure-brightness.mjs` takes the mean luma of the middle of each screenshot. `docs/evidence/brightness-before-m18.txt` and `brightness-after-m18.txt` hold the numbers.
  - Rooms went from 8.7–10.5 to 15.1–17.7.
  - The phone lobby went from 8.0 to 27.0.
  - Floors 2, 3 and 5 rose by 4 points each.
  - One lobby view went from 25.4 to 23.9, because avatar positions differ between runs.
- **Checks (2026-11-11):**
  - typecheck exit 0; 136 shared + 8 web unit tests; 90 server integration tests; build exit 0.
  - **Full E2E, stored run (2026-11-11 09:33, load 2.9 at the start): 29 passed, exit 0** (`docs/evidence/test-e2e.txt`). The production smoke test passed too.
  - Earlier full and single-spec runs at load averages of 19 to 97 failed the door 2B walk in `rooms.spec.ts`. The load came from macOS storage scanning processes (`StorageManagementService`, `Storage.appex`), about 150% CPU for 1–2 days.
  - `rooms.spec.ts` run alone passed fully in 3 of 15 runs at loads between 18 and 97. The runs covered three variants: with the extra point lights, without them, and with a test-helper change that was then reverted.
