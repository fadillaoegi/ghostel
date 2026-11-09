# Requirements — Milestone 10: Ghoul's Diner (floor 4) and the rooftop on floor 5

Owner request (2026-11-08, Indonesian, summarised): "add a canteen on floor 4 as a gimmick, move the rooftop to floor 5; the canteen has many tables to sit and chat at". The owner accepted Kiro's recommendations (snack ordering, no candies in the canteen, rooftop candies move with the rooftop).

## User stories
1. As a guest, I can take the elevator to five floors: 1 Grand Lobby, 2 Hall of Portraits, 3 Moonlit Greenhouse, 4 Ghoul's Diner, 5 Rooftop Graveyard.
2. As a guest in the Diner, I see a food counter with a skeleton cook, a menu board, a bubbling soup pot, many tables for 2 and 4, and night windows; a vampire waiter walks the aisle.
3. As a guest at the counter, I press E (or tap) to open the menu and order a snack. My character holds it for about a minute and everyone who can see me sees it.
4. As a guest on the rooftop (now floor 5), I still see the night city below, the tombstones and the three rooftop candies.
5. As a guest, the Diner has its own music.

## Acceptance criteria
- `FLOORS` lists five floors in order; the elevator panel offers all five; `floor` messages accept 1–5.
- The server only accepts an order when the guest is on floor 4, within reach of the counter by the server's own position, for a known snack id, and at most once every 3 seconds per connection. Snack state is part of the public player (`snack`), cleared by the server after 60 seconds, and broadcast only to the guest's current channel.
- Candies: still 12; three each on floors 1, 2, 3 and 5; none on floor 4. Existing candy ids keep working, so nobody loses progress or the crown.
- Tables on every floor and in the Diner are obstacles that players cannot walk through (sitting comes in M12). All candy spots, elevator arrivals and prompt zones stay walkable; NPC paths stay inside the walls.
- All earlier tests pass after updating floor numbers.
