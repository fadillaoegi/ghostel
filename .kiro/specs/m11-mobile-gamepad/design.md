# Design — Milestone 11

> **Written after implementation.** This spec was written right after the code, in the same session (2026-11-08), not before it as the workflow requires. The decisions in it were agreed with the owner in chat first. See `docs/KIRO-ACTIVITY.md`, session 3.

- `ui/Joystick.tsx`: `Joystick` is a fixed `pad-zone` over the left 46 % × 62 % of the screen (40 % × 75 % in landscape). Pointer-down anywhere in it places the stick base under the finger; release returns it to its resting spot. The resting stick keeps `data-testid="joystick"` so old tests still drag it. `ActionButton` is the round A button.
- `input/controls.ts`: `input.pad` plus `useGamepad({onAction, onBack}, enabled)`, a requestAnimationFrame poll of `navigator.getGamepads()` (dead zone 0.22, d-pad 12–15, A = 0, B = 1, edge-triggered). `readMoveVector` uses keys, then the touch stick, then the gamepad.
- `ui/Lobby.tsx`: touch footer = stick + icon grid + A button; `actionLabel(prompt)` gives the short label; full-screen toggle when `document.fullscreenEnabled`.
- CSS: every phone rule (`max-width: 820px`) also applies to short touch screens (`max-height: 520px and pointer: coarse`). An extra landscape block: two-column creator, centred scrolling panels, chat as a right-side panel, smaller A button. A portrait block keeps the icons in rows of three and the prompt above them. Inside the footer the stick zone has z-index 0 and the buttons 1, so buttons stay tappable.
- No pinch-zoom blocking via the viewport meta (accessibility); the canvas and stick use `touch-action: none`, buttons `manipulation`.

## Testing
`e2e/mobile.spec.ts`: portrait action button and elevator; landscape fit checks, stick movement seen by a desktop guest, elevator panel and chat inside the viewport; fake gamepad through `navigator.getGamepads` override.
