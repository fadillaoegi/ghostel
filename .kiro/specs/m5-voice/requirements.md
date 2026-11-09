# Requirements — Milestone 5: Voice in rooms

> **Superseded in part by M12.** The `voice_*` protocol, "Join voice" button and the 6-voice limit below were replaced by seats and calls in `m12-seats-and-meetings` (2026-11-08). This spec is kept as the record of milestone 5.

Audio-only voice chat inside rooms. No video. WebRTC peer-to-peer, signaled over the existing WebSocket.

## Requirement 1 — Joining and leaving
1. Inside a room, THE HUD SHALL show "Join voice". Voice SHALL only start after that click (browser autoplay and microphone rules).
2. WHEN the guest clicks "Join voice", THE client SHALL ask for the microphone (echo cancellation, noise suppression, auto gain) and connect to every guest already in the room's voice call.
3. IF the page is not a secure context (HTTPS or localhost) or the microphone is denied or missing, THEN THE UI SHALL explain why voice is unavailable and the guest SHALL stay in the room.
4. THE guest SHALL be able to mute and unmute, and to leave voice without leaving the room.
5. WHEN a guest leaves the room, closes the tab or the room is deleted, THE server SHALL remove them from the call and tell the others.
6. Voice SHALL NOT be available in the lobby.

## Requirement 2 — Server rules for signaling
1. THE server SHALL relay signaling (offer, answer, ICE candidate) only between two connections that are both in the same room AND both in its voice call. Everything else SHALL be dropped.
2. THE sender of a relayed signal SHALL be set by the server (public connection ID); clients cannot choose it.
3. THE server SHALL cap a call at 6 participants (mesh audio) and refuse more with a clear reason.
4. THE server SHALL limit signal sizes (SDP ≤ 12,000 characters, ICE candidate ≤ 1,000) and count malformed signals as invalid messages.
5. Mute state SHALL be broadcast only to the room's channel.

## Requirement 3 — Feedback
1. Name tags of guests in the call SHALL show a microphone mark, a muted mark when muted, and a glow while they are speaking (measured locally from the received audio).
2. THE HUD SHALL show the call state: connecting, number of connected peers, muted.

## Requirement 4 — Configuration and privacy
1. ICE servers come from server configuration (`VOICE_ICE_SERVERS`, JSON) and are served at `GET /api/voice` to guests with a session. The default is one public STUN server.
2. Peer-to-peer voice reveals each participant's IP address to the others in the call. THE README SHALL say so. Some networks need TURN; LiveKit Cloud (Build plan) is the documented fallback for later.

## Acceptance criteria
- Two guests in the same room hear each other (verified in E2E with Chromium's fake microphone: connection established and remote audio level detected).
- Guests in the lobby or in other rooms never receive the call's signaling or mute states.
- A guest in the room but not in the call cannot send signals to the call.
- Leaving the room ends that guest's part of the call for everyone.
