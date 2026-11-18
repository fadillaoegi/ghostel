# Tasks — M25

- [x] 1. Steering: `product.md` and `security.md` (presentation audio follows the screen rules)
- [x] 2. `call.ts`: capture audio with the screen, send it in the screen stream, route it on receipt
- [x] 3. `Presentation.tsx`: audio element, volume and mute for viewers; sound status for everyone
- [x] 4. E2E in `present.spec.ts`
- [x] 5. Typecheck, tests, build; evidence; docs

## Results (2026-11-18)
- `e2e/present.spec.ts`: 2 of 2 pass (`docs/evidence/test-e2e-present-m25.txt`).
  - The test logged `screen audio source: native`: Chromium's fake screen capture returned its own audio track with `audio: true`, so the injected test tone was not needed.
  - Checked in the test:
    - The presenter sees "🔊 Sharing sound" and has no playback element of her own.
    - The seated guest's `present-audio` plays a live, unmuted, flowing audio track.
    - That stream is not on any voice element.
    - The slider sets the volume to 0.3, and mute and unmute work.
- `voice.spec.ts` and `oddities.spec.ts` (camera, mic, mirror): 4 of 4 (`test-e2e-voice-m25.txt`).
- `pnpm typecheck` exit 0; unit tests 138 shared + 12 web; build exit 0 (`checks-m24-m25.txt`).
- Screenshot: `docs/evidence/screenshots/desktop-present-screen.png`, with the volume control at the top left of the stage.
- Screen share frame rate: ideal 15 / max 30 fps (was 8 / 15), so videos move smoothly. This uses more upload bandwidth for the presenter.

## Not verified
- Real browsers and real sound by ear. To share a video's sound in Chrome or Edge, share a **tab** and tick "Share tab audio" (Windows and ChromeOS can also share system audio).
- macOS system audio, Safari and Firefox usually give no audio track. The share then shows "🔇 no sound".
- The full E2E suite after M25 (only the three call-related specs ran).
