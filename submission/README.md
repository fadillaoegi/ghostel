# Submission material

## Demo video intro and outro (M21)
| File | Length | Format |
| --- | --- | --- |
| `ghostel-intro.mp4` | 7.0 s (210 frames) | 1920×1080, 30 fps, H.264 yuv420p, AAC 48 kHz stereo |
| `ghostel-outro.mp4` | 7.0 s (210 frames) | same |

Put the intro before the screen recording and the outro after it. Together they use 14 s of the 3-minute limit. The MP4s are gitignored (`*.mp4`), so a fresh clone has to render them first (see "Re-render").

One frame per second of each file: `docs/evidence/screenshots/video-intro-frames.jpg` and `video-outro-frames.jpg`. The render log and `ffprobe` output are in `docs/evidence/video-render.txt`.

### What happens
**Intro**
- 0–2.7 s: the camera glides down a graveyard path at night toward a jack-o'-lantern on a pedestal. Fence posts, lamps, tombstones, ghosts, bats, the hotel, the moon and the stars sit at different depths.
- 2.0–3.0 s: the pumpkin charges up. It shakes and glows while the camera does a dolly zoom (it pushes in as the lens widens, so the background stretches away).
- 3.0 s: the pumpkin explodes into 420 low-poly shards, with a flash, two shockwave rings and camera shake. Bats scatter.
- 3.5–4.7 s: the shards swirl together into the letters of the "GHOSTEL" sign, and the neon flickers on.
- 5.0 s: "Check in. Hang out. Play till dawn." and "A haunted hotel built with Kiro · Kiroween 2026". The intro fades to black at the end.

**Outro**
- 0–2 s: the lit sign with "Thanks for checking in.". The camera drifts back.
- 2.1–3.0 s: the neon flickers and fails.
- 3.0 s: the sign explodes into embers that rise and cool down, and a swarm of bats flies out.
- 3.7 s: credits (Ghostel, the tagline, "Built with Kiro for Kiroween 2026", the GitHub URL, and the app URL if one is given). The outro fades to black at the end.

### Sound
`video/scripts/make-audio.ts` synthesizes the sound offline from oscillators and seeded noise. No samples or recordings are used. The melody is Ghostel's own lobby theme, "Waltz of the Lost Keys" (`apps/web/src/ui/scores.ts`), played with the same music-box and celesta recipes as the app (`apps/web/src/ui/music.ts`). Around it are wind, a low drone, a riser, a boom on the explosion frame, crackles, a reverse whoosh into the letters, a shimmer, and a neon hum that cuts out on the same frames as the picture's flicker. Both picture and sound read their timing from `video/src/timeline.ts`.

### Re-render
```sh
pnpm install
pnpm --filter @ghostel/video render    # writes video/public/*.wav, then both MP4s here
# Add the live app URL to the outro credits once the app is deployed:
pnpm --filter @ghostel/video exec remotion render src/index.ts Outro ../ghostel-outro.mp4 --gl=angle --crf=18 --props='{"appUrl":"https://your-domain"}'
# A single frame for review:
pnpm --filter @ghostel/video exec remotion still src/index.ts Intro /tmp/intro-95.png --frame=95 --gl=angle
```
The first render downloads Chrome Headless Shell (about 140 MB). Every frame is a pure function of its frame number, using seeded randomness and no clock, so a re-render gives the same picture. `pnpm --filter @ghostel/video studio` opens Remotion Studio for previewing.

### Licenses
- Remotion (`remotion`, `@remotion/cli`) uses the **Remotion License**, which is not an open source license. It is free for individuals, for-profit organizations with up to 3 employees, and non-profits. Larger companies need a Company License. `@remotion/three` is MIT. See `docs/ASSETS.md`.
- Every visual is made in code: three.js primitives, canvas text in Creepster and Nunito (both OFL), and Ghostel's palette. The sound is synthesized by the script above. The video project is MIT like the rest of the repo, and nothing from it ships in the app's production build.

## Feature footage (screen recordings for the demo video)
Made by scripted browser runs against the production build (`pnpm footage`, config `playwright.footage.config.ts`, scripts in `footage/`). Chrome's screencast is turned into 1920×1080, 30 fps H.264 by ffmpeg. The footage has **no sound**: Chrome's screencast does not record audio. Add music or a voice-over in the edit.

| File | Length | Category echo | What happens |
| --- | --- | --- | --- |
| `footage/frankenstein-haunted-mirror.mp4` | 41 s | Frankenstein (M16) | Check in as "Victor" with the Frankenstein head → elevator to floor 2 → walk the Hall of Portraits to the Mirror of Costumes → "Look into the mirror": the camera image appears in the glass as a ghost (violet tint, ripple) → step left and right → one click turns it off again |
| `footage/resurrection-night-desk.mp4` | 49 s | Resurrection (M16) | In the Grand Lobby, walk to the Night Desk → press E: the 1987 green-screen terminal boots → `WHO` and `ROOMS` list the live hotel → the text adventure is played to "CHECKOUT COMPLETE" → Escape back to the 3D lobby |
| `footage/skeleton-crew-game-kit.mp4` | 50 s | Skeleton Crew (M17) | One game kit, two games: house room 1A, Pumpkin Trivia against Jack O'Bot (3 short questions, reveal, podium) → leave → house room 1B, Monster Pairs on the same `GameEngine` (cards flipped at a human pace, matches, podium "YOU WIN!") |
| `footage/floor-1-grand-lobby.mp4` | 19 s | Costume Contest (tour) | From the front doors past the fountain ghost and the reception (neon sign, concierge), along the pillars and room doors 1A–1D, and back to the middle |
| `footage/floor-2-hall-of-portraits.mp4` | 18 s | Costume Contest (tour) | The elevator ride up, then the whole gallery from west to east: portraits whose eyes follow you, room doors 2A–2F, the runway and the Mirror of Costumes |
| `footage/floor-3-moonlit-greenhouse.mp4` | 21 s | Costume Contest (tour) | A loop round the bubbling cauldron, past the giant pumpkins that light up as you pass, the fireflies and Gourdon the gardener |
| `footage/floor-4-ghouls-diner.mp4` | 21 s | Costume Contest (tour) | Along the food counter with the skeleton cook and the menu board, then down between the checkered tables and across the dining room |
| `footage/floor-5-rooftop-graveyard.mp4` | 28 s | Costume Contest (tour) | Out to the edge above the lit night city, along it past the mausoleum, then back past the telescope, tombstones and water tower |
| `footage/lobby-chat-four-guests.mp4` | 38 s | Costume Contest (social) | Four guests in the Grand Lobby: Pumpkin Pete (recorded, real UI) and three friends in costume (Vlad the vampire, Luna Howl the werewolf, Mr Bones the skeleton pirate) walk up, chat with speech bubbles and the lobby chat panel, then race off to door 1A |

The three friends in the chat clip are real guests (cookie session, WebSocket, moves and chat checked by the server), driven from blank pages by `footage/lobby-chat.footage.ts`, so only one 3D page renders. Their lines are scripted.

The games run in their short test form (`TRIVIA_FAST`: 3 questions and 4 pairs), so the clip stays short. Jack O'Bot really wins the trivia round in this recording; nothing is staged. Record when the machine is quiet (`uptime` load below about 4). At a load of 10–12 the first greenhouse take had only 13 distinct frames per second; the re-take at a load of 2 had 25. Record a single clip with `pnpm footage footage/<name>.footage.ts`, or one floor with `pnpm footage footage/floors.footage.ts -g "Floor 3"`.

The `.mp4` files are gitignored (`*.mp4`), so they stay local. Re-record them like this:
```sh
pnpm build
pnpm db:up
# Placeholder camera (a grey silhouette, made with ffmpeg; no real person):
ffmpeg -f lavfi -i "color=c=black:s=640x480:r=20:d=8" -vf "format=gray,geq=lum='…'" -f yuv4mpegpipe /tmp/silhouette.y4m   # full filter in docs/evidence/footage-frankenstein.txt
FOOTAGE_CAMERA=/tmp/silhouette.y4m pnpm footage
# Or with your real webcam, so the mirror shows you (macOS may ask to allow the camera for the terminal app):
FOOTAGE_REAL_CAMERA=1 pnpm footage
```
Without `FOOTAGE_CAMERA` or `FOOTAGE_REAL_CAMERA`, Chrome's built-in test pattern (a green screen with a timer) appears in the mirror.
