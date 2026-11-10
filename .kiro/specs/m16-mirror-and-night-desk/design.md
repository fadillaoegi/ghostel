# Design — M16

## Haunted Mirror (floor 2)

### Camera, local only
`apps/web/src/ui/mirrorCam.ts` is a small external store (`subscribe`, `getSnapshot`) with `start()` and `stop()`.
- `start()` calls `getUserMedia({ video: CAMERA_CONSTRAINTS, audio: false })` (constraints from `packages/shared/src/calls.ts`). It puts the stream on a detached, muted `<video playsInline>` and plays it.
- A start token guards against races: if `stop()` runs while the permission prompt is open, the late stream is stopped at once.
- `stop()` stops every track and drops the video.
- Status: `off | starting | on | error`, plus an error text for refused or missing cameras.
- It does not import `CallClient`. The call's camera (`call.ts`) and the mirror's camera are separate streams, so the mirror can never reach a peer or a `media` message.

### Wiring in `Lobby.tsx`
- A "Look into the mirror" button shows next to the mirror prompt (`data-testid="mirror-cam"`, `data-cam=<status>`, `aria-pressed`).
- An effect stops the camera whenever the current prompt is not the mirror. This covers walking away, sitting down, changing scene and opening another scene. The unmount cleanup also stops it.
- Errors show as a toast (`data-testid="mirror-error"`).

### Rendering in `Gallery.tsx`
- `Mirror` reads the store. When a video exists, the oval surface switches from the shimmering standard material to `CameraReflection`, a `shaderMaterial` with a `THREE.VideoTexture` (sRGB, disposed on cleanup).
- Fragment shader steps:
  - Horizontal flip.
  - Cover crop: `uScale` is computed each frame from `videoWidth / videoHeight` against the oval's aspect (2.04 × 2.96).
  - Slow sine ripple.
  - Luminance mapped from deep violet to ghost white, with a little of the original colour.
  - A faint drifting double image.
  - Scanlines and a violet vignette at the rim.
- `toneMapped={false}`, `fog={false}`, `#include <colorspace_fragment>` for output conversion.

## Night Desk terminal (lobby)

### Layout (`packages/shared`)
- `NIGHT_DESK = { minX: 4.5, maxX: 5.9, minZ: -10, maxZ: -9.2 }` in `layout.ts`, added to `LOBBY_OBSTACLES` as a box labelled `night-desk`.
  - The desk is centred under the north window at x = 5.5.
  - It sits 1.3 from the reception (more than a guest's width, 0.8, so no trap gap) and clear of the elevator door (7.75).
- `PromptKind` gains `terminal`. The lobby's `promptZones` adds `{ kind: "terminal", x: 5.2, z: NIGHT_DESK.maxZ + 0.9, r: 1.2 }`.
  - A guest stepping out of the lobby elevator and walking west passes through it.
  - Where the two zones overlap, the terminal zone wins because it is nearer.

### Game rules (`packages/shared/src/nightdesk.ts`)
- `startNightDesk()` returns `{ state, lines }`.
- `nightDeskStep(state, raw, ctx)` returns `{ state, lines, clear?, exit? }`.
- `normalizeCommand(raw)` returns the cleaned string, or `null` when it is too long.
- The state is immutable:
  - `room`: `desk | office | corridor | closet | room13`
  - `has`: `{ ledger, key }`
  - `bellRung`, `doorOpen`, `done`, `moves`
- `ctx = { guests: string[], doors: { code, name | null }[] }`, used by `WHO` and `ROOMS`.
- Walkthrough: N, TAKE LEDGER, S, RING BELL, E, N, SEARCH SHEETS, S, OPEN DOOR, E, SIGN LEDGER.
- Meta commands (HELP, LOOK, WHO, ROOMS, CLEAR, INVENTORY) do not count as moves.

### UI (`apps/web/src/ui/NightDesk.tsx`)
- A modal styled as a CRT: dark bezel, green VT323 text with glow, scanline overlay, vignette, slow subtle flicker (disabled with reduced motion).
- The log is capped at 120 lines (`role="log"`).
- The input has `aria-label="Command"` and a `>` prompt. Quick-command buttons sit underneath.
- A key click comes from `sfx.key` (respects the SFX mute).
- The input autofocuses on desktop only, so the phone keyboard does not cover the screen at once.
- The modal state is `"terminal"`. `useKeyboardControls(modal === null)` already stops walking, and gamepad B closes modals.

### 3D (`apps/web/src/three/NightDesk.tsx`)
- Rendered by `LobbyHall` for the `night-desk` obstacle.
- Parts:
  - A low-poly wooden desk.
  - A dark bakelite CRT monitor. Its screen plane shows "NIGHT DESK" in VT323 green through `useLabelTexture`, plus a softly pulsing cursor.
  - A keyboard.
  - A small green point light.
- Everything stays under the window sill (top below y = 1.3).

## Security notes
- The mirror camera starts only from a click and stays on the device (rule added to `security.md`).
- The terminal adds no WebSocket or HTTP input. Names shown by `WHO` come from server-validated profiles and are rendered as text.

## Tests
- `packages/shared/test/nightdesk.test.ts`:
  - The walkthrough reaches `done`.
  - The door is hidden before the bell and locked without the key.
  - SIGN only works in room 13 with the ledger.
  - Normalization and the length limit.
  - WHO and ROOMS output.
  - RESTART and EXIT.
  - The terminal zone exists and is walkable.
- Existing `tables.test.ts` and `npcs.test.ts` cover the new obstacle and zone automatically.
- `e2e/oddities.spec.ts`:
  - The terminal story and a screenshot `desktop-night-desk.png`. The guest rides 2 → 1 and walks west from the lobby elevator.
  - The mirror camera on, then off by walking away, with a screenshot `desktop-mirror-camera.png`.
