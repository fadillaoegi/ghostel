# Design — M18

- **Global:** raise the renderer's tone-mapping exposure from 1.0 to 1.15 in `WorldScene.tsx` (`onCreated`). Materials with `toneMapped={false}` (signs, screens, candles) are not affected, so they keep their glow and do not wash out.
- **Fog:** the lobby and floors fog starts at 16 and ends at 46, which darkens the back wall the camera looks at. Move it to 20 and 60. The rooftop keeps its own long fog.
- **Per scene** (ambient / hemisphere / directional; the room and the lobby also get one warm fill light):
  - Lobby (`Decor.tsx` `Lights`): 0.6 / 0.8 / 0.9 → 1.0 / 1.1 / 1.0, plus a warm fill light above the hall.
  - Rooms (`RoomInterior.tsx`): 0.85 / 0.55 / 0.5 → 1.3 / 0.95 / 0.8, plus a warm fill light above the long table.
  - Gallery: 0.95 / 0.8 → 1.1 / 0.95.
  - Greenhouse: 0.6 / 0.6 → 0.9 / 0.85.
  - Rooftop: 0.55 / 0.55 → 0.8 / 0.8. It stays a night sky.
  - Diner: unchanged; only the global exposure applies.
- **Check:**
  1. Re-run the E2E specs that take these screenshots.
  2. Measure them again with `scripts/measure-brightness.mjs`.
  3. Look at the screenshots.
  4. If a scene washes out, step its values back.
- Point lights stay few. Visual-style asks for about 3 lit jack-o'-lanterns per scene, and these two fill lights are the only new ones.
