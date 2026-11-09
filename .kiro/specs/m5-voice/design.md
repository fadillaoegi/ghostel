# Design — Milestone 5: Voice in rooms

> **Superseded in part by M12.** The `voice_*` protocol, "Join voice" button and the 6-voice limit below were replaced by seats and calls in `m12-seats-and-meetings` (2026-11-08). This spec is kept as the record of milestone 5.

## Protocol (`packages/shared/src/protocol.ts`, `voice.ts`)
- `MAX_CLIENT_FRAME_BYTES` grows from 1 KB to 16 KB, because SDP offers are a few KB. The per-message schemas keep tight limits (move and chat unchanged).
- `VOICE_MAX_PEERS = 6`, `SDP_MAX = 12000`, `ICE_MAX = 1000`.
- Client → server:
  - `{ t: "voice_join" }`, `{ t: "voice_leave" }`, `{ t: "voice_mute", muted: boolean }`
  - `{ t: "voice_signal", to: string(≤32), data: { kind: "offer" | "answer", sdp: string } | { kind: "ice", candidate: string, sdpMid: string | null, sdpMLineIndex: number | null } }`
- Server → client:
  - `{ t: "voice_peers", peers: { id, muted }[] }` (sent to the joiner: who is already in the call)
  - `{ t: "voice_joined", id }`, `{ t: "voice_left", id }`, `{ t: "voice_mute", id, muted }`
  - `{ t: "voice_signal", from, data }`
  - `{ t: "voice_denied", code: "not_in_room" | "full", message }`

## Server (hub)
- `Connection.voice: { muted: boolean } | null`.
- `voice_join`: must be in a room (else `voice_denied not_in_room`); call size < 6 (else `full`); then set voice, send `voice_peers` (others in call), broadcast `voice_joined` to the room channel.
- `voice_signal`: drop silently unless the sender is in voice, and the target with that public ID is in the same channel and in voice. Relay as `{ from: sender.publicId, data }`.
- `voice_mute`: only when in voice; broadcast to the channel.
- `voice_leave`, `moveTo` (exit / enter another room / room closed), `detach` → `leaveVoice()` broadcasts `voice_left` to the old channel.
- `GET /api/voice` → `{ iceServers }` from `config.voiceIceServers` (parsed and validated at startup; default `[{ urls: "stun:stun.l.google.com:19302" }]`).

## Web
- `net/voice.ts` `VoiceClient` (one per room visit):
  - `join()`: check `isSecureContext` and `navigator.mediaDevices`; `getUserMedia({ audio: { echoCancellation, noiseSuppression, autoGainControl } })`; fetch ICE servers; send `voice_join`.
  - On `voice_peers`, the joiner creates an `RTCPeerConnection` per peer, adds its track, and sends the offer. Existing members answer. This rule ("newcomer offers") avoids glare without full perfect-negotiation.
  - ICE candidates trickle through `voice_signal`. Candidates that arrive before the remote description are queued.
  - Remote tracks go to hidden `<audio autoplay>` elements. Because the user clicked "Join voice", autoplay is allowed.
  - Levels: one `AudioContext` with an `AnalyserNode` per stream (self + remotes), sampled every 120 ms. A level above a threshold counts as speaking, with 400 ms hangover.
  - State for React: `{ status: "off" | "starting" | "on" | "error", error?, muted, peers: Map<id, { connected, muted }>, speaking: Set<id | "self"> }`.
  - `leave()` closes the peer connections, stops the tracks, closes the AudioContext and sends `voice_leave`.
- `PresenceClient` forwards `voice_*` messages to a registered handler and exposes `sendVoice(msg)`.
- The HUD (rooms only) shows Join voice / Mute / Leave voice and "🎙️ n connected".
- Name tags get `data-voice="on|muted|speaking"` plus CSS (mic badge, glow ring).

## Testing
- Unit: voice message parsing and size limits.
- Integration: join and peers list; relay only between call members in the same room; outsider (lobby, other room, same room but not in call) cannot send or receive; forged `from` is impossible; cap 6; mute broadcast only to the channel; leaving the room or deleting it ends voice; voice in the lobby is denied.
- E2E (Chromium `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`, mDNS host candidates disabled for localhost): two guests join voice in a room; each sees "1 connected" and the other's name tag reaches `data-voice="speaking"` from the fake microphone's beep. Mute shows on the other side. Leaving the room removes the peer.
