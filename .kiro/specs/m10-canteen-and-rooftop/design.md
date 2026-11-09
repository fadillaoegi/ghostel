# Design — Milestone 10

## Shared (`packages/shared`)
- `floors.ts`: `FloorNumber` 1–5, `UpperFloor` 2–5. Floor 4 `CANTEEN_BOUNDS` {x ±16, z ±11}, counter box obstacle on the north wall (x −4.5…8.5, z ≤ −8.6), elevator on the north wall at x −12. The rooftop definitions move to floor 5 unchanged. Prompt kind `counter` in front of the counter.
- `tables.ts` (new): `FLOOR_TABLES` per floor (`id`, centre, 2 or 4 seats). Each table becomes a circle obstacle (r 1.2 for 2 seats, 1.35 for 4) and has seat positions and facing angles. Layouts of floors 1–5 include table obstacles. Seats are used in M12.
- `canteen.ts` (new): `SNACKS` (id, name, emoji), `isSnackId`, `COUNTER_SPOT`, `COUNTER_SERVER_REACH` 2.8, `SNACK_MS` 60 000, `ORDER_COOLDOWN_MS` 3000.
- `protocol.ts`: client `{t:"order", snack}`; server `{t:"snack", id, name, snack|null}`; `PublicPlayer.snack?`.
- `npcs.ts`: floor 4 Chef Bones (skull head, skeleton costume, behind the counter) and Count Crumbs (vampire waiter on the centre aisle); the old floor 4 NPCs and tombstone talkers move to floor 5.
- `candies.ts`: rooftop candies keep their ids and move to floor 5.

## Server
- `hub.ts`: elevator accepts floors 1–5. `order` handler with the checks above; `conn.snack {snack, until}`; expiry in the existing 200 ms game timer, broadcast to the guest's channel. Snacks stay with the guest across scene changes until they expire (included in `welcome` players).

## Web
- `floors/Canteen.tsx`: tiled floor, counter with soup pot and cook's window, menu board (canvas text), tables with chairs (`three/Tables.tsx`, used on every floor), hanging lamps, arched night windows.
- `Rooftop.tsx` renders for floor 5; fog and camera settings follow.
- `ui/SnackMenu.tsx`: modal listing the snacks; `Lobby.tsx` opens it from the `counter` prompt.
- `Avatar` gets an optional held `snack` prop drawn by `three/Snack.tsx` next to the right hand.
- Music: new theme "Swing for Hungry Ghouls" (vibraphone lead, walking bass with off-beat chords) for floor 4; the rooftop theme follows floor 5.

## Testing
- Shared: five floors, walkability of tables/candies/arrivals/zones, NPC paths, snack ids, protocol parsing.
- Server: order accepted at the counter, refused far away / other floor / unknown id / too fast; expiry broadcast; isolation from other floors; elevator to floor 5.
- E2E: ride to the Diner, order a snack, a second guest sees it; floors spec updated to five floors; screenshots of the Diner.
