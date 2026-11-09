# Requirements — Milestone 13: camera in calls

> **Written after implementation.** This spec was written after the code was built (2026-11-09), not before it as the workflow requires. See `docs/KIRO-ACTIVITY.md`, session 3.

Owner request (2026-11-08): "make it possible to open the camera". Confirmed: camera off by default, on only after a click.

## Acceptance criteria
- In any call (room or table) a "Camera" button turns the camera on and off. The browser permission prompt appears only after that click.
- Camera video is small (about 320×240 at 15 fps) to keep the peer-to-peer mesh light.
- Other members see the camera in that person's meeting tile; your own tile shows your camera mirrored.
- Leaving the call (standing up at a floor table, leaving the room, changing floor, closing the tab) stops the camera.
