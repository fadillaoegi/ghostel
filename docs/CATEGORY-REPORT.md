# Ghostel: Kiroween 2026 category report

Written 2026-11-08.

## Sources and what is unverified
- The category list and submission requirements below come from the "Kiro Weekly Reading List – 1st November 2026" (AWS Builder Center): https://builder.aws.com/content/3LWfIgHmjUGOCCYX7sZXC0DJSn6/kiro-weekly-reading-list-1st-november-2026
- The official Devpost pages (https://kiroween.devpost.com/ and `/rules`) returned HTTP 403 to automated fetching. **The official rules and the 2026 judging criteria have not been read directly.** Read them in a browser before submitting.
- Facts as summarised from that source (rephrased):
  - Entries must be new projects, started on or after 2026-10-30. Ghostel started on 2026-11-07 and shares no code with Ghost Turtle Kit.
  - Entries must use Kiro (IDE, CLI, Web or Crew) and enter one of four categories: Resurrection (revive a dead technology), Frankenstein (combine seemingly incompatible technologies), Skeleton Crew (one lean template shown through two different apps), Costume Contest (any app with a haunting, polished UI).
  - A submission needs a public open-source GitHub repo with `/.kiro` at the root, a working app, a demo video under 3 minutes, and a write-up of how Kiro was used.
  - Deadline: 2026-12-04 14:00 PT.
  - Bonus prizes include Best Startup Project, Best Kiro Crew App, Best Demo and student prizes. A public blog post can earn bonus credits.

## Recommendation
**Enter Costume Contest.** Ghostel's main strength is the experience: a 3D haunted hotel with its own visual identity, music and characters.

Frankenstein is a reasonable fallback, but its pitch would be weaker (see below). Resurrection and Skeleton Crew do not fit.

## Costume Contest: which parts carry it

| Part of the app | Where | Why it matters for "haunting, polished UI" |
| --- | --- | --- |
| Character creator with a live 3D preview, monster heads (vampire, werewolf, Frankenstein, zombie, alien), costumes such as bat wings and a skeleton, colour swatches, "Surprise me" and a reward hat | `apps/web/src/ui/Creator.tsx`, `three/Avatar.tsx` | First screen a judge sees; a costume theme that fits the category name |
| Grand Lobby (fountain ghost, pumpkins, candles, bats, moon, neon sign) | `three/LobbyHall.tsx`, `three/Decor.tsx` | Atmosphere from the first second |
| Four floors: Hall of Portraits (eyes follow you, runway, Mirror of Costumes), Moonlit Greenhouse (pumpkins glow as you pass, bubbling cauldron, fireflies), Rooftop Graveyard (giant moon, stars, readable epitaphs, a lit night city far below) | `three/floors/*.tsx`, `three/Elevator.tsx` | Variety and things to discover; each floor has its own look |
| NPC ghosts and monsters on every floor (mummy, vampire concierge who greets you by name, Frankenstein curator, werewolf gardener, zombie, alien tourist), talking portraits and tombstones | `packages/shared/src/npcs.ts`, `three/Npcs.tsx` | A solo judge is never in an empty world |
| Original music, one theme per floor, performed live in the browser with cross-fades | `ui/music.ts`, `ui/scores.ts` | Sound design without stock audio |
| Name tags, speech bubbles, voice glow and the scene fade | `three/nametags.tsx`, `styles.css` | Readable, lively social layer |
| Pumpkin Trivia: timer bar, coloured answer cards, reveal, podium with confetti, synthesized SFX | `ui/TriviaPanel.tsx`, `ui/sfx.ts` | A polished, shareable moment for the demo video |
| Numbered room doors (1A to 3D) with live plaques; occupied doors stand ajar and glow | `three/RoomDoors.tsx`, `packages/shared/src/doors.ts` | Rooms feel like places in the hotel, and "meet me at 2B" works |
| Ghoul's Diner: skeleton cook, vampire waiter, jukebox, order a snack you visibly hold | `three/floors/Canteen.tsx`, `three/Snack.tsx`, `packages/shared/src/canteen.ts` | A playful gimmick judges can try in seconds |
| Sit at a table and the hotel turns into a Zoom-like meeting with costume badges or cameras; presentations (screen or PDF slides) on a big screen inside the 3D room | `ui/MeetingView.tsx`, `ui/Presentation.tsx`, `three/RoomInterior.tsx` | The haunted hotel becomes a place to actually meet, not just walk around |
| On-screen gamepad for phones in portrait and landscape; physical gamepads | `ui/Joystick.tsx`, `input/controls.ts` | Judges on phones get console-like controls |
| Candy hunt across the floors that unlocks a Golden Crown | `packages/shared/src/candies.ts`, `three/Candies.tsx` | A reason to explore everything during judging |
| Phone layout: joystick, chat sheet, 2×2 trivia grid, compact HUD | `styles.css` (mobile rules), `ui/Joystick.tsx` | Judges may open the link on a phone |

### Known weaknesses for this category
- The web bundle is 1.38 MB (379 kB gzip). The first load on a slow phone can feel heavy.
- No real-phone test yet. Phone screenshots come from Chromium emulation.
- Lighting differs between floors. The gallery and rooftop are moody, and some judges may find them dark.
- The demo video does not exist yet and will strongly shape how the UI is judged.

## Frankenstein (fallback)
Stitched pieces: a React Three Fiber 3D world, server-authoritative WebSocket presence, WebRTC voice signalled through that socket, a pluggable multiplayer game engine, Web Audio synthesis for music and sound effects, and PostgreSQL with argon2 password rooms. These pieces work together, but they are not "seemingly incompatible", which is the core of the category. The pitch would be weaker than Costume Contest.

## Not a fit
- **Resurrection:** no dead technology is revived.
- **Skeleton Crew:** needs one template plus two distinct apps. Ghostel is one app.

## Bonus prizes worth considering
- **Best Demo:** depends on the video; Pumpkin Trivia and the floors give good scenes.
- **Blog post bonus credits:** `docs/KIRO-ACTIVITY.md` already holds an honest build log to adapt.
- **Best Startup Project:** possible angle ("virtual venue for small communities"), but not the focus.
- **Best Kiro Crew App:** not applicable. Kiro Crew was not used.

## Kiro usage evidence for the write-up

| Kiro feature | Evidence in the repo | Status |
| --- | --- | --- |
| Specs | `.kiro/specs/m1-check-in-and-lobby` … `m9-monsters-city-doors` (requirements, design, tasks per milestone) | Done, written before each milestone's code |
| Steering | `.kiro/steering/{product,architecture,security,language-and-workflow,attribution}.md` | Done; loaded as workspace rules during the session |
| Hooks | `.kiro/hooks/shared-tests-on-save.json` | **Created but never seen firing.** Verify in a new session before claiming it. |
| Agent instructions | `AGENTS.md` | Done |
| Honest log | `docs/KIRO-ACTIVITY.md`, `docs/evidence/` | Done; real command output only |

## Submission checklist (status 2026-11-08)
- [x] New project started after 2026-10-30
- [x] `.kiro/` at the repository root
- [x] Open-source license (MIT, `LICENSE`)
- [ ] Public GitHub repository (owner pushes)
- [ ] Working public URL (deploy prepared in `render.yaml` and `docs/DEPLOY.md`; needs the owner's accounts)
- [ ] Demo video under 3 minutes
- [ ] Devpost write-up including how Kiro was used
- [ ] Read the official rules and judging criteria directly (Devpost was not reachable from the agent)
