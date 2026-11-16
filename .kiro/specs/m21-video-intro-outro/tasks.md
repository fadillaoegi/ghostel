# Tasks — M21

- [x] 1. Steering and docs: `submission.md` (video pieces), `architecture.md` (the `submission/video` package), Remotion license in `docs/ASSETS.md`
- [x] 2. Package, workspace entry, Remotion config, fonts, timeline
- [x] 3. 3D pieces: world, pumpkin, bats, ghost, shards, sign; the `Intro` and `Outro` scenes with overlays
- [x] 4. Audio script with the lobby waltz; generate the WAVs
- [x] 5. Render stills of each phase, look at them, fix what looks wrong
- [x] 6. Render both MP4s into `submission/`; store the real output in `docs/evidence/`; typecheck
- [x] 7. `submission/README.md`, PROGRESS, HANDOFF, KIRO-ACTIVITY, specs index

## Results (2026-11-14/15)
- `pnpm --filter @ghostel/video audio`: two WAVs of 7.00 s, 48 kHz 16-bit stereo, peak −1.00 dBFS, 0 clipped samples.
- Renders: `ghostel-intro.mp4` (5.9 MB) and `ghostel-outro.mp4` (4.5 MB), both exit 0.
- `ffprobe` on both: 1920×1080, 30 fps, 210 frames, H.264 yuv420p, AAC 48 kHz stereo, 7.019 s.
- Log: `docs/evidence/video-render.txt`.
- The audio was decoded back out of the MP4s and measured in 0.5 s windows. The loudest window in both files is the one at 3.0 s, which is the explosion frame (90).
- One frame per second of each MP4 was looked at: `docs/evidence/screenshots/video-intro-frames.jpg` and `video-outro-frames.jpg`.
- The `appUrl` prop was tested with a still (`--props='{"appUrl":"https://ghostel.example.com"}'`); the URL showed under the GitHub link. The committed outro has no app URL.
- Root `pnpm typecheck` (now 4 workspace packages plus the root): exit 0, `docs/evidence/typecheck-m21.txt`.

## Changes found while building
- Remotion 4.0.543 marks `Audio` as deprecated (renamed `Html5Audio`), so the scenes use `Html5Audio`.
- The first still failed: Chrome Headless Shell had just been downloaded and did not answer within 25 s ("Timed out … while trying to connect to the browser"). The retry worked, and every later render did too.
- In the first stills, the hotel's lit windows showed through the "GHOSTEL" letters. `Sign` got a dark, soft backing behind the letters. It fades in while the shards gather (intro) and is always on in the outro.
- The first audio mix had a quiet hole after the explosion (about −38 dB from 3.6 to 4.2 s). The riser, crackles and reverse whoosh were made louder, and the whoosh grows faster.
- Every render prints the three.js warning "THREE.Clock: This module has been deprecated". It comes from React Three Fiber, not from this code, and does not change the picture.

## Not verified
- Kiro cannot listen. The sound was checked only by measuring loudness over time, not by ear. The owner should listen before using it.
- Whether the owner is eligible for the Remotion Free License (as an individual) is his to confirm.
