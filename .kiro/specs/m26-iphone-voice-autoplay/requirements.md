# Requirements — Milestone 26: iPhone listeners hear the call

**Written after the first attempt at the code** (2026-11-24), during diagnosis. The first attempt is recorded in `tasks.md` because it broke tests; the final fix was written after this spec.

Owner report (2026-11-24, Indonesian): the camera does not show in a call; the friend uses an **iPhone**, the owner a laptop.

## Findings
- Production already runs M22–M25 (checked in the served bundle), and `Permissions-Policy` allows camera and microphone.
- "0 connected" between a phone on mobile data and a laptop is the missing TURN relay (M22, owner's VPS). That is a deployment step, not code.
- A code issue that iPhones hit specifically: every remote voice plays through a hidden `<audio>` with `play()` called when the track arrives. iPhone Safari refuses unmuted playback outside a user gesture unless the page is capturing (mic or camera on). A guest who sits down and only listens hears nothing, and the refusal was swallowed silently.
- Ghostel primed audio on `pointerdown` and `keydown` only. WebKit grants user activation on the end of a touch (`touchend`, `click`), not on `pointerdown`.

## What
1. When a remote voice's `play()` is refused, remember that element.
2. The next tap or key press (`pointerdown`, `pointerup`, `touchend`, `click` or `keydown`) starts exactly those elements again. Elements that already play are not touched.
3. Elements are forgotten when their peer leaves.

## Done when
- `voice.spec.ts`, `present.spec.ts` and `mobile.spec.ts` still pass.
- Typecheck and unit tests pass.
- The owner checks with a real iPhone: sit at a table without unmuting, tap anywhere once, and hear the laptop.
