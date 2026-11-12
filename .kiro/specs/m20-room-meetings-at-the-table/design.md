# Design — M20

## Hub (`apps/server/src/realtime/hub.ts`)
- `callKeyFor(conn)` returns `seat ? <channel>#<table> : null` in every scene, rooms included. A room's key is therefore `room:<id>#long`.
- `callState(key)` takes its kind from the key prefix (`room:` means `room`) and its table from after `#`.
- `meetingKey(channel)` is `<channel>#long` for a room channel. `inMeeting(conn)` checks `conn.place.kind === "room" && conn.callKey === meetingKey(conn.channel)`.
- `syncCall(conn)`:
  - When a room connection **joins** the meeting, it receives the current `presentation`, plus `present_requests` if it is the owner.
  - When it **leaves** the meeting (stand, or a seat change that leaves the meeting) but stays in the room, `leavePresentations(conn, channel)` runs. The connection then receives `presentation: null` and, if owner, `present_requests: []`.
  - Leaving the room or disconnecting is already handled by `leaveChannel`, which calls `leavePresentations`.
- Delivery:
  - `broadcastPresentation(channel)` sends to `callMembers(meetingKey(channel))` only.
  - `sendRequests(channel)` sends to seated owners only.
  - `moveTo` into a room sends `presentation: null`, so the client clears any old state. The guest is not seated yet.
- Checks:
  - `presentRequest` sends the notice "Sit at the long table to join the meeting first." when the guest is not in the meeting.
  - `presentDecide` treats a non-owner as invalid (unchanged) and ignores an owner who is not in the meeting. It also re-checks that the requester is still in the meeting.
  - `presentStop` ignores a guest who is not in the meeting, and requires the presenter or the owner.
  - `slidesFor` requires a connection of that guest with `callKey === meetingKey(channel)`.
- `CALL_MAX_MEMBERS` stays 9 as a safe upper bound. The comment is updated: a room call is now at most its 8 chairs.

## Web
- `Lobby.tsx`:
  - Removes the room `CallBar` and the floating `stage-float` panel.
  - `PresentRequests` is shown only when seated (`inRoom && place.owner && seated`).
  - A standing guest in a room sees a small hint, "🪑 Sit at the long table to join the meeting: voice, camera and presentations." (`data-testid="meeting-hint"`).
  - The `stageMin` state goes too.
- `MeetingView.tsx`: removes `CallBar`, which has no users left. The `.hud-voice` CSS is kept only if something else uses it; otherwise it is removed.
- The client call code needs no change: the server's `call: null` already ends the call, and stopping the mic, camera and screen is handled there.

## Docs and steering
- `product.md` (seats, presentations), `security.md` (calls, presentation state and slides), `architecture.md` (call key).
- README.
- Notes at the top of the M12 and M14 specs: "the room rule is superseded by M20".
