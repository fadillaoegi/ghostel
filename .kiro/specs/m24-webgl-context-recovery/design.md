# Design — M24

- `apps/web/src/three/contextGuard.ts`: `useContextGuard()` returns:
  - `canvasKey`, used as the `key` of `<Canvas>`. Changing it mounts a fresh canvas and context. R3F disposes the old renderer when it unmounts.
  - `status`: `"ok" | "recovering" | "failed"`.
  - `watch(canvas)`, called from `onCreated`.
  
  It listens for `webglcontextlost` (calling `preventDefault()`, which allows a restore) and `webglcontextrestored`. A 2 s timer remounts if no restore comes. On `visibilitychange` back to visible, it checks `isContextLost()` and remounts at once. Attempts are counted per minute, and after 3 the status is `"failed"`.
- `WorldScene.tsx`: `<Canvas key={canvasKey} onCreated={…watch(gl.domElement)}>`. A `.scene-recovering` layer (`data-testid="scene-recovering"`) sits over the stage, in the night colour, with the text and, on failure, a Reload button.
- Everything outside the canvas (presence, call, chat, HUD) is untouched by the remount. The local player starts from the server's position in the presence snapshot, as it already does on scene changes.
