# Design — M21

## Package `submission/video` (`@ghostel/video`)
- Dependencies: `remotion`, `@remotion/cli`, `@remotion/three` 4.0.543, `react` and `react-dom` 19.3.1, `three` 0.187.0 and `@react-three/fiber` 9.8.2 (the same versions as the app), `@fontsource/creepster`, `@fontsource/nunito`. `tsx` is used for the audio script.
- `src/timeline.ts`: frames per second, duration and phase frames. The scenes and the audio script both import it, so picture and sound cannot drift apart.
- `src/index.ts` → `src/Root.tsx`: the `Intro` and `Outro` compositions. `Outro` takes an `appUrl` prop.
- `src/fonts.ts`: imports the fontsource CSS and holds the render with `delayRender` until `document.fonts.load` resolves for Creepster and Nunito.
- `src/three/`:
  - `random.ts`: a seeded PRNG.
  - `textures.ts`: canvas text and glow textures.
  - `textPoints.ts`: samples the lit pixels of the sign's canvas, so the shards' targets are exactly the letters.
  - `World.tsx`: the graveyard, moon, stars, mist, lamp posts and fence.
  - `Pumpkin.tsx`, `Bats.tsx`, `Ghost.tsx`, `Shards.tsx` (the explosion and the gathering), `Sign.tsx`.
- Every animated value is a pure function of the frame. No `useFrame` and no clock.
- `scripts/make-audio.ts`: a small offline synthesizer (oscillators, envelopes, filtered noise, a Schroeder reverb). It imports the lobby waltz from `apps/web/src/ui/scores.ts` and writes `public/intro.wav` and `public/outro.wav` (48 kHz, 16-bit stereo, normalized to −1 dBFS). The files are generated, so `public/*.wav` is gitignored.
- Scripts:
  - `pnpm --filter @ghostel/video audio`
  - `render:intro` and `render:outro`: `remotion render … --gl=angle --crf=18`, output into `submission/`
  - `render`: both renders
  - `still`: single frames for review
  - `typecheck`
  - `studio` exists for the owner. Kiro does not start it.
- The workspace (`pnpm-workspace.yaml`) gains `submission/video`, so the root typecheck covers it.

## Shards (the explosion)
- 420 tetrahedrons (`detail 0`, flat shaded), in pumpkin, flame and violet colours. Each shard has a seeded start point on the pumpkin's surface, an outward velocity and a spin.
- **Intro:**
  - Burst, frames 90–105: position = start + v·(1 − e^(−k·t))/k, an explosion with drag.
  - Gather, frames 105–140: an eased flight to the shard's letter point, with a swirl offset that peaks halfway.
  - Hold and shrink, frames 140–152, while the sign's texture fades in.
- **Outro:** start at the letter points. At frame 90 the shards burst outward and up, then drift up as embers. They turn from orange to dim red and shrink by frame 175.
- They are drawn as individual meshes that share one geometry and one material per colour. That is fine for offline rendering, and it keeps the code declarative, which is what Remotion's three integration requires.

## Camera
- **Intro:** z 30 → 9, y 4.5 → 2.6 (ease out), looking at the pumpkin, then at the sign. A shake after the burst decays over 12 frames.
- **Outro:** a slow pull back, rising, with a slight orbit.

## Overlay (DOM over the canvas)
A vignette, the burst flash, the tagline and the credits text (Creepster titles, Nunito lines), and the fades to black.
