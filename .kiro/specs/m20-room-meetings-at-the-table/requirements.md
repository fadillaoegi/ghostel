# Requirements — Milestone 20: room meetings happen at the long table

Written before the code, on 2026-11-12.

Owner request (2026-11-12, Indonesian, with a screenshot of a standing guest in room 1C who still sees the call bar with mic, camera and "Ask to present"): "When you sit at the meeting table you should enter a Zoom-like page, and when you stand up you leave the Zoom (the meeting room). But right now you can still present while standing. Fix this first."

## What changes (product decision, replaces the M12/M14 room rule)
- **Before (M12, M14):** a room was one call for everyone inside. Standing guests had a call bar (mic, camera, "Ask to present"), a floating presentation panel, and could present.
- **Now:** a room's meeting is its long table, the same as a table on a floor.
  - Sitting at the long table joins the room's call and opens the meeting view.
  - Standing up leaves the call and closes the meeting view.
  - Standing guests in a room have no call controls, cannot ask to present, cannot present, and receive no presentation state or slides.

## User stories
1. As a guest in a room, I sit at the long table and the Zoom-like meeting opens with everyone seated there.
2. As a guest who stands up, I leave the meeting: my mic and camera stop, and if I was presenting, the presentation ends.
3. As a standing guest in a room, I see a hint that I can sit at the long table to join the meeting, and nothing else of the call.
4. As the room owner seated at the table, I see requests to present and can allow or refuse them, and I can stop a presentation.

## Acceptance criteria (server is the authority)
- A room's call members are exactly the guests seated at its long table. The call key is `room:<id>#long`, the call kind is `room`, and the table is `long`.
- Signaling, media announcements and call state reach only seated members.
- `present_request` from a guest who is not seated is refused with the notice "Sit at the long table to join the meeting first." It is not counted as an invalid message, because a standing guest may click before the server's seat update arrives.
- `present_decide` and `present_stop` from an owner who is not seated are ignored. A non-owner deciding still counts as invalid.
- Standing up, leaving the room or disconnecting drops the guest's request and ends their presentation. The screen share stops being announced, and the slides are deleted.
- `presentation` and `present_requests` messages go only to seated members, and `present_requests` only to a seated owner. A guest who sits down receives the current presentation (and requests, if owner). A guest who stands up receives `presentation: null` and an empty request list.
- Slides download only for a guest seated at that room's table (other guests get 404).
- Floor tables are unchanged.
- The web shows no call bar, floating stage or request list to standing guests in rooms. The room's TV shows a presentation only to seated guests, because only they receive it.

## Tests
- Server: room calls (only seated guests, standing leaves, signals between seated only); presentations (all existing cases with seated guests; plus a standing guest who asks, standing presenter ends it, standing guest gets no presentation and no slides).
- E2E: the room call test and both presentation tests sit first. A standing guest has no call bar and sees the hint. Folding the meeting view keeps a live screen share playing (replaces the old floating-panel minimize step).
