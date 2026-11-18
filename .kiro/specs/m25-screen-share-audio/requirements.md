# Requirements — Milestone 25: share audio with a screen presentation

Written before the code, on 2026-11-18.

Owner request (2026-11-18, Indonesian): when presenting, also share audio, for example when opening a video.

## Today
- `CallClient.startScreen()` calls `getDisplayMedia({ video, audio: false })`. A video played during a presentation is seen without sound.

## What
1. Screen sharing asks the browser for audio too (`audio: true`). The browser's own picker decides what can be shared:
   - Chrome and Edge on desktop: a tab's audio, and system audio on Windows and ChromeOS. The guest ticks "Share tab audio" or "Share system audio" in the picker.
   - Safari, Firefox and macOS system audio usually give no audio track. Sharing still works, without sound.
2. When the shared screen has audio, guests seated at the table hear it with the presentation. Each guest gets a separate volume slider (and mute) for the presentation sound, so the presenter's voice stays clear.
3. The presenter does not hear the shared audio played back by Ghostel (no echo). Their tab already plays it.
4. The meeting shows whether sound is shared: "🔊 with sound" or "🔇 no sound". The presenter's controls say how to include sound when it is missing ("tick 'Share tab audio' in the picker").
5. Stopping the share, standing up, leaving or the browser's "Stop sharing" button stop the audio too.
6. A video needs smooth motion as well. The screen share frame rate goes from ideal 8 / max 15 fps to **ideal 15 / max 30**. Resolution is unchanged (up to 1920×1080).

## Security and rules
- Same rules as the screen video: only the approved presenter shares, and only members of that call receive it (`security.md`). The audio track belongs to the same stream as the screen video, so the server's existing check of the presenter's screen stream id covers it, and nothing new is announced.
- Capture still starts only from the presenter's click.

## Done when
- With Chromium's fake capture (`--use-fake-device-for-media-stream`), a seated guest receives an audio track in the presenter's screen stream, and their presentation audio element plays it.
- The volume slider changes that element's volume.
- The presenter has no playback element for their own screen audio.
- Typecheck, unit tests, build and `present.spec.ts` pass.
