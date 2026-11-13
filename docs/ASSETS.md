# Assets and licenses

## 3D models
All 3D content is built in this repo from three.js primitives (boxes, cones, cylinders, icosahedrons) in:
- `apps/web/src/three/Avatar.tsx` — guest character parts, including the M9 monster heads (vampire, werewolf, Frankenstein, zombie, alien), hats (pirate, bat ears) and costumes (bat wings, skeleton, wizard robe, zombie rags, werewolf fur)
- `apps/web/src/three/LobbyHall.tsx` — hall, pillars, fountain, reception, porch, tombstones
- `apps/web/src/three/RoomDoors.tsx` — numbered room doors with live plaques (canvas text)
- `apps/web/src/three/Decor.tsx` — pumpkins, candles, bats, moon
- `apps/web/src/three/RoomInterior.tsx` — room themes (coffins, bookshelves, chandelier, table, crystal ball)
- `apps/web/src/three/Npcs.tsx` — NPC ghosts (monster NPCs reuse the Avatar parts)
- `apps/web/src/three/floors/{Gallery,Greenhouse,Rooftop}.tsx`, `Elevator.tsx`, `Candies.tsx` — floors 2–4, elevators, candies
- `apps/web/src/three/floors/Canteen.tsx` — Ghoul's Diner: counter, soup pot, jukebox, lamps, windows, menu board (canvas text)
- `apps/web/src/three/Tables.tsx`, `Snack.tsx` — tables and chairs on every floor and the rooms' long tables; the six Diner snacks
- `apps/web/src/three/floors/City.tsx` — the night city below the rooftop: seeded instanced buildings with canvas window textures, traffic, street lights, river and bridge, clock tower, church, radio mast
- `apps/web/src/three/NightDesk.tsx` — the Night Desk: desk, CRT monitor, keyboard (M16)
- The Haunted Mirror's camera shader (`apps/web/src/three/floors/Gallery.tsx`, M16) was written for this project. It only processes the guest's own camera image, on the guest's device.

No external model files are used yet. License: MIT, same as the project.

## Textures
Generated at runtime on `<canvas>` (`apps/web/src/three/textures.ts`, `RoomDoors.tsx`, `floors/City.tsx`): floor checker, moon halo, sign text, door plaques, city windows. No image files. `scripts/measure-brightness.mjs` (M18) only measures screenshots and is not part of the app.

## Sound
All sounds are synthesized at runtime with the Web Audio API: `apps/web/src/ui/sfx.ts` (trivia effects) and `apps/web/src/ui/music.ts` (instruments and reverb). No audio files.

## Music
The five themes in `apps/web/src/ui/scores.ts` were composed for Ghostel in this project: "Waltz of the Lost Keys", "Minuet for Watching Eyes", "Lullaby for Sleeping Pumpkins", "Swing for Hungry Ghouls" (Ghoul's Diner) and "Nocturne for a Full Moon" (MIT).

## Text content
The 36 Pumpkin Trivia questions (`packages/shared/src/games/trivia-questions.ts`), all NPC lines (`packages/shared/src/npcs.ts`), the Night Desk text adventure (`packages/shared/src/nightdesk.ts`, M16) and the Monster Pairs rules and card names (`packages/shared/src/games/pairs.ts`, M17; the card faces are standard Unicode emoji drawn by the guest's system font) were written for this project (MIT). The Night Desk's `XYZZY` reply is a one-word nod to the 1970s game Colossal Cave Adventure; no text from it is used.

## Fonts
| Font | Package | License |
| --- | --- | --- |
| Creepster | `@fontsource/creepster` 5.3.0 | SIL Open Font License 1.1 |
| Nunito | `@fontsource/nunito` 5.3.0 | SIL Open Font License 1.1 |
| VT323 (Night Desk terminal, M16) | `@fontsource/vt323` 5.3.0 | SIL Open Font License 1.1 (checked in the package's `LICENSE`, 2026-11-10) |
| pdf.js standard fonts (Foxit Serif/Sans/Fixed/Symbol/Dingbats) | copied from `pdfjs-dist` 6.5.438 `standard_fonts/` to `/pdfjs/standard_fonts/` at build | BSD-3-Clause (PDFium authors), file `LICENSE_FOXIT` |
| Liberation Sans (pdf.js standard fonts) | same | SIL Open Font License 1.1, file `LICENSE_LIBERATION` |

The pdf.js fonts are only used to draw text inside PDF slides that guests upload.

## Icons
`apps/web/public/favicon.svg` was drawn for this project (MIT). UI emoji are rendered by the visitor's system font.

## npm packages
Direct runtime dependencies (React, three.js, React Three Fiber, drei, Fastify, ws, pg, zod, @node-rs/argon2) are MIT. `pnpm licenses list --prod` on 2026-11-07 counted: MIT 123, ISC 9, BlueOak-1.0.0 6, Apache-2.0 5, BSD-3-Clause 4, OFL-1.1 2 (the fonts). The Apache-2.0 packages (`@dimforge/rapier3d-compat`, `@mediapipe/tasks-vision`, `draco3d`, `hls.js`, `promise-worker-transferable`) come in transitively through drei. All of these licenses are permissive and compatible with MIT distribution.

Added on 2026-11-08: `pdfjs-dist` 6.5.438 (Apache-2.0, Mozilla), a direct dependency of the web app for PDF slides. Checked in the build on 2026-11-09: the copied worker (`pdf.worker.min-*.mjs`) keeps Mozilla's Apache-2.0 notice. The main pdf.js chunk bundled by Vite does not keep it, so this entry is the notice for that code (Copyright Mozilla Foundation, Apache License 2.0, https://www.apache.org/licenses/LICENSE-2.0).

Added on 2026-11-12: `@vitejs/plugin-basic-ssl` 2.3.0 (MIT, its `LICENSE` checked), a dev dependency of the web app. It is used only by `pnpm dev:lan` to serve the dev server over HTTPS with a self-signed certificate. It is not part of the production build.
