# Requirements — Milestone 21: intro and outro for the demo video

Written before the code, on 2026-11-14.

Owner request (2026-11-14, Indonesian, summarised): make an intro and a closing animation for the demo video, with attractive, deep 3D motion and sound that fits the app, and an "explode" effect. Use Remotion. Put it in a `submission` folder.

## Why
- Presentation is 20% of the judging, and Best Demo is picked by the Presentation score (`submission.md`). The first and last seconds of the video set the tone for a Costume Contest entry.
- The whole video must stay under 3 minutes, so each piece is short: 7 seconds.

## What
- `submission/video/`: a Remotion project (a pnpm workspace package) with two compositions, `Intro` and `Outro`, each 1920×1080, 30 fps and 7 s.
- The rendered files are `submission/ghostel-intro.mp4` and `submission/ghostel-outro.mp4`. The owner puts them before and after the screen recording.

### Intro
1. The camera glides at night down a graveyard path toward a glowing jack-o'-lantern on a pedestal. Tombstones, lamp posts, fence posts, mist, stars, the moon and bats are layered at different depths, so the motion reads as deep 3D.
2. The pumpkin charges up (it shakes and glows), then explodes into hundreds of low-poly shards with a flash, a shockwave ring and camera shake.
3. The shards swirl and fly together into the letters of the "GHOSTEL" sign, which then lights up like the lobby's neon sign.
4. The tagline "Check in. Hang out. Play till dawn." and "A haunted hotel built with Kiro · Kiroween 2026" appear. The intro fades to black.

### Outro
1. The lit "GHOSTEL" sign over the graveyard, with "Thanks for checking in." The camera drifts back.
2. The sign flickers, then explodes into shards that turn into rising embers, and a swarm of bats flies out.
3. Credits: Ghostel, the tagline, "Built with Kiro for Kiroween 2026", the repository URL, and the app URL when it exists (an input prop, empty by default because the app is not deployed yet). Then it fades to black.

### Sound
- Synthesized in this repo, like the app's music (no recordings, no stock sounds). It is written as WAV by a script and played by Remotion.
- It uses the app's own lobby theme ("Waltz of the Lost Keys", `apps/web/src/ui/scores.ts`) on a music box and a celesta, plus wind, a low drone, a riser before the explosion, a deep boom, crackling embers, a shimmer when the letters form, and a final chord.
- The sound is timed to the same timeline constants as the picture.

## Constraints
- Every visual is made in code from three.js primitives and canvas text (Creepster and Nunito, both OFL). There are no external models, textures, video or audio, and the palette is Ghostel's.
- Animation is deterministic (Remotion `useCurrentFrame`, seeded randomness), so every render is identical.
- Remotion's license is not open source: it is free for individuals and companies of up to 3 people. This is recorded in `docs/ASSETS.md`, and the owner confirms that he qualifies.
- The video project is separate from the app: nothing from it ships in the production build.
- No claims that are not true (no "winner", no user numbers).

## Done when
- Both MP4s are rendered into `submission/`, and frames from each phase have been looked at.
- The audio script and the render commands are recorded, and their real output is stored in `docs/evidence/`.
- Typecheck passes, including the new package.
