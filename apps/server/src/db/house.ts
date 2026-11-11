import { createHash, randomBytes } from "node:crypto";
import { DEFAULT_LOOK, type RoomDecor, type RoomGame } from "@ghostel/shared";
import type { Pool } from "./pool";

/** The hotel's own guest. Its token hash comes from random bytes, so no cookie can ever match it. */
export const CONCIERGE_ID = "00000000-0000-4000-8000-00000000c0de";

export const HOUSE_ROOMS: readonly { id: string; name: string; decor: RoomDecor; game: RoomGame; slot: string }[] = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Pumpkin Trivia Hall", decor: "ballroom", game: "pumpkin_trivia", slot: "A" },
  // Monster Pairs since M17 (it was Pumpkin Trivia before).
  { id: "00000000-0000-4000-8000-000000000002", name: "Midnight Library", decor: "library", game: "monster_pairs", slot: "B" },
  { id: "00000000-0000-4000-8000-000000000003", name: "The Quiet Crypt", decor: "crypt", game: "none", slot: "C" },
];

/** Makes sure the house rooms exist and run their games. Safe to run on every start. */
export async function ensureHouseRooms(pool: Pool): Promise<void> {
  const unusableHash = createHash("sha256").update(randomBytes(32)).digest();
  await pool.query(
    `INSERT INTO guests (id, token_hash, name, look) VALUES ($1, $2, 'The Concierge', $3) ON CONFLICT (id) DO NOTHING`,
    [CONCIERGE_ID, unusableHash, JSON.stringify({ ...DEFAULT_LOOK, head: "skull", hat: "top" })],
  );
  for (const room of HOUSE_ROOMS) {
    await pool.query(
      `INSERT INTO rooms (id, owner_id, name, access, password_hash, decor, game, floor, slot, updated_at)
       VALUES ($1, $2, $3, 'open', NULL, $4, $5, 1, $6, now() - interval '1 year') ON CONFLICT DO NOTHING`,
      [room.id, CONCIERGE_ID, room.name, room.decor, room.game, room.slot],
    );
    // Guests cannot edit house rooms, so the hotel may change their game between releases.
    await pool.query(`UPDATE rooms SET game = $3 WHERE id = $1 AND owner_id = $2 AND game <> $3`, [room.id, CONCIERGE_ID, room.game]);
  }
}
