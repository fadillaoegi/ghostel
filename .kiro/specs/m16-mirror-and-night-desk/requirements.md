# Requirements — Milestone 16: the Haunted Mirror and the Night Desk terminal

Written before the code, on 2026-11-10.

Owner request (2026-11-10, Indonesian, summarised): Ghostel is submitted to Costume Contest, but it should also contain parts that echo the other Kiroween categories. Start with Frankenstein and Resurrection; think about Skeleton Crew later. Kiro proposed a live-camera mirror (Frankenstein) and a green-screen terminal with a text adventure (Resurrection); the owner said "lanjut Frankenstein dan Resurrection dulu".

## Why
- Costume Contest stays the category. Both features must also make the hotel look and feel better, so they help that category too.
- Frankenstein: a webcam feed stitched into the 3D scene through a custom shader.
- Resurrection: a 1987-style CRT terminal (VT323 phosphor font, scanlines) running an original piece of interactive fiction, a genre of the 1970s–80s.

## User stories
1. As a guest on floor 2, when I stand at the Mirror of Costumes I can click "Look into the mirror" and see my own camera image in the mirror, turned into a ghostly reflection. Only I see it.
2. As a guest, the mirror's camera turns off when I click again, walk away from the mirror, sit down, change floor or leave.
3. As a guest in the Grand Lobby, I find an old computer on a desk next to the reception. Walking up and pressing E (or tapping) opens the Night Desk terminal.
4. As a guest at the terminal, I can type commands and play a short mystery ("one guest never checked out of room 13") that can be finished in about 10 commands.
5. As a guest at the terminal, `WHO` lists the guests in the lobby and `ROOMS` lists the lobby's doors, like an old hotel system.
6. As a phone user, the terminal has quick buttons (LOOK, N, S, E, W, HELP) so I can play without much typing.

## Acceptance criteria
### Haunted Mirror
- The camera starts only from a click or tap on the mirror button. The button is shown only while the guest is in the mirror's prompt zone, with no modal open and not seated, and only where `getUserMedia` is available (secure context).
- The mirror stream is separate from calls: it is never attached to a peer connection, never announced in a `media` message, and never sent to the server. Video only, no audio.
- The camera stops (all tracks stopped) when the guest clicks again, leaves the mirror zone, changes scene, or the lobby view unmounts. A track that ends by itself (device unplugged) also resets the mirror.
- If permission is refused or no camera exists, the guest sees a short message and the mirror stays as it was.
- The reflection is mirrored horizontally (like a real mirror), cropped to the oval without stretching, and drawn with a ghostly tint, slow ripple, scanlines and a violet edge. No flashing.
- The button says that only the guest can see the image.

### Night Desk terminal
- A desk with a CRT monitor and keyboard stands against the lobby's north wall, east of the reception, under a window. It is an obstacle in `packages/shared` (`layout.ts`), so nobody walks through it.
- A prompt zone of kind `terminal` in front of it is walkable. Candy spots, elevator arrivals, other prompt zones and NPC paths keep their tests.
- The game rules live in `packages/shared/src/nightdesk.ts` as pure functions. Input is normalized (NFC, control and bidi characters removed, spaces collapsed, upper case) and limited to 40 characters. Output is plain text rendered by React (no HTML).
- The adventure runs in the browser only. It sends nothing to the server, stores nothing and gives no reward, so there is no new client input for the server to validate. `WHO` and `ROOMS` read only data the client already has.
- The story and all text are original, written for Ghostel.
- Commands: HELP, LOOK, N/S/E/W (and GO …), TAKE, READ, RING, SEARCH, OPEN/UNLOCK, SIGN, INVENTORY, WHO, ROOMS, CLEAR, RESTART, EXIT. Unknown words get a classic "I don't know the word" reply.
- Escape, the close button, `EXIT` and gamepad B close the terminal. While it is open the avatar does not move.
- The terminal uses the VT323 font (OFL, `@fontsource/vt323`), recorded in `docs/ASSETS.md`. Flicker respects `prefers-reduced-motion`.

### Both
- Unit tests for the adventure (full walkthrough, locked door, input limits, WHO and ROOMS) and the existing layout tests pass.
- An E2E test opens the terminal, finishes the story and saves a screenshot. Another turns the mirror camera on with Chromium's fake camera, checks it is live, walks away and checks it stopped, and saves a screenshot.
- Typecheck, unit, integration, build and the affected E2E specs pass; real output goes to `docs/evidence/`.
