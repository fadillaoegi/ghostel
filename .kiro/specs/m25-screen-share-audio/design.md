# Design — M25

## `apps/web/src/net/call.ts`
- `getDisplayMedia({ video: SCREEN_CONSTRAINTS, audio: SCREEN_AUDIO })`:
  - `SCREEN_AUDIO`: echo cancellation, noise suppression and auto gain **off** (it is music or video, not speech).
  - `suppressLocalAudioPlayback: false`, so the presenter still hears their own tab.
  - `systemAudio: "include"` where supported (the extra fields are hints; browsers ignore unknown ones).
- Senders get a fourth slot, `screenAudio`. `attachTracks` adds the screen's audio track with the **same stream** as the screen video (`addTrack(track, screenStream)`), so the receiver sees both in one stream whose id is the announced `screen` id. `stopStream("screen")` removes both senders.
- Receiving, `ontrack`:
  - Today every audio track goes to the voice `<audio>` element. Now an audio track goes to the voice element only if its stream is not the stream that carries this peer's video.
  - Because the screen stream also has a video track, the rule is: an audio track whose stream has (or later gets) a video track is presentation audio. It is stored in `peer.streams` like the video.
  - Voice stays on its own stream (the mic stream has audio only).
- `RemoteMedia` gains nothing new: the presentation `screen` stream now simply may contain an audio track.
- `CallSnapshot.localScreenAudio: boolean`, true when our share has an audio track.

## `apps/web/src/ui/Presentation.tsx`
- For viewers: a hidden `<audio data-testid="present-audio">` bound to the presenter's screen stream when it has an audio track, with the volume from a slider (`data-testid="present-volume"`, 0–100, default 80) and a mute button.
- The meeting stage shows "🔊 with sound" or "🔇 no sound".
- The presenter sees "🔊 Sharing sound" or a hint about ticking "Share tab audio".
- The presenter never renders the audio element for their own stream.

## Tests
- `e2e/present.spec.ts`, screen share test:
  - With Chromium's fake capture, the shared stream has an audio track (to be confirmed by the test).
  - Assert that the guest's `present-audio` element has a live audio track and is not paused, that the slider changes `volume`, and that the presenter has no `present-audio`.
