# Tasks — Milestone 5: Voice in rooms

- [x] 1. Shared: voice constants and protocol messages, frame cap 1 KB → 16 KB, unit tests (6 new)
- [x] 2. Server: hub voice membership, signal relay rules, mute, cleanup on leave/close/delete; `GET /api/voice` + `VOICE_ICE_SERVERS` config
- [x] 3. Server integration tests for voice (8 new)
- [x] 4. Web: `VoiceClient` (getUserMedia, mesh peer connections, ordered signal queue, ICE queueing, levels)
- [x] 5. Web: HUD controls, call status, name-tag voice marks, error messages
  - Also: name tags of guests standing close together are now nudged apart (seen in the M4 and M5 screenshots)
- [x] 6. E2E with fake microphone: connect, speaking (both directions), mute, leave room, leave voice
  - Found: Chrome holds `getUserMedia` until the page has focus. With several contexts the test must `bringToFront()` before clicking "Join voice"; real users always click on a focused page.
- [x] 7. Evidence and docs (README privacy note)
