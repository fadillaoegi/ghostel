---
inclusion: fileMatch
fileMatchPattern: "apps/web/src/three/**"
---

# Visual style for 3D scenes (loaded only when a file in `apps/web/src/three/` is read)

Ghostel targets the Costume Contest category, so every scene should look deliberate, spooky and cosy.

## Geometry
- Low-poly from three.js primitives only: boxes, cylinders and cones with few segments (6–14), icosahedrons at detail 0–1, `flatShading` on organic shapes.
- No external model, texture or audio files. Text and patterns are drawn on a `<canvas>` (`textures.ts`: `useLabelTexture`, `makeCheckerTexture`) and wait for the web fonts (`document.fonts.load`).
- Everything that blocks walking must also be an obstacle in `packages/shared` (`layout.ts`, `floors.ts`, `tables.ts`). Never add a solid-looking prop in the scene alone.

## Palette (from the existing scenes)
- Night background and fog `#0b0614`; floor 5 fog `#120c22`.
- Pumpkin `#ff7a1a` with glow `#ff9a2e`; flame `#ffcf5a`; gold trim `#c9a227` / `#b88a3e`.
- Walls: lobby `#2a1b3d`, gallery `#5a2440`, diner `#3a1f2e`; ecto green `#7ed957`; ghost white `#f4f1de`.
- Signs: Creepster font with a coloured glow; small labels in Nunito.

## Light and effects
- Each floor sets its own ambient + hemisphere + one directional light and a few point lights. Lit jack-o'-lanterns (`Pumpkin lit`) add a point light each: keep them to about 3 per scene.
- **Light budget:** each point or spot light costs every lit pixel (M19 measured 39 → 56 fps in the lobby on Retina by going from 8 to 5 point lights). Keep about 5 per scene and prefer emissive or `meshBasicMaterial` glows. Merge repeated static props with `three/merge.ts`.
- Sparkles and bats for life; slow, subtle animation (sin/cos of elapsed time), never flashing.

## Performance budget
- Target 60 fps on a laptop and smooth play on a mid-range phone. Use instancing for repeated meshes (`City.tsx` is the example), memoize textures and geometries, and dispose textures you create (`useEffect` cleanup).
- Avoid per-frame React state; mutate refs inside `useFrame`.
- Check new scenes with a screenshot in an E2E test (`docs/evidence/screenshots/`) and look at it before calling the work done.
