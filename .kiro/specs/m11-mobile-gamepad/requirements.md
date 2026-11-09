# Requirements — Milestone 11: phone gamepad, landscape layout, physical gamepads

> **Written after implementation.** This spec was written right after the code, in the same session (2026-11-08), not before it as the workflow requires. The decisions in it were agreed with the owner in chat first. See `docs/KIRO-ACTIVITY.md`, session 3.

Owner request (2026-11-08): "make it responsive on phones in portrait and landscape, with an analog stick to move the character, like a gamepad that appears in mobile mode". The owner also accepted Kiro's offer to support physical gamepads.

## User stories
1. On a touch screen I move with an analog stick that appears under my thumb anywhere on the left part of the screen.
2. A big round action button on the right does whatever the current spot offers (enter or book a door, call the elevator, try costumes, order a snack; later sit and stand). When there is nothing to do it is dimmed.
3. In landscape the HUD, panels, creator and chat fit the short screen: panels scroll, chat opens on the right side.
4. With a physical gamepad (Bluetooth or USB, standard mapping) the left stick or d-pad moves, A does the action, B closes the open panel.
5. On Android a full-screen button hides the browser bars.

## Acceptance criteria
- Portrait 390×844 and landscape 844×390 phones (touch): the stick, action button, place name and candy counter are fully on screen; no horizontal overflow on the creator; elevator panel and chat input stay inside the viewport.
- The stick moves the character as seen by another guest (portrait and landscape).
- The action button is labelled with the action (e.g. "Action: Elevator") and triggers it.
- A fake standard gamepad in the browser moves the character and opens and closes the elevator panel with A and B.
- Existing phone tests still pass.
