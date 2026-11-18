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
