import { DEFAULT_LOOK, cleanCandies, lookSchema, type Profile } from "@ghostel/shared";
import type { Pool } from "./pool";

export interface Guest extends Profile {
  id: string;
  /** Candy ids found so far (validated against the known list). */
  candies: string[];
}

interface GuestRow {
  id: string;
  name: string;
  look: unknown;
  candies: unknown[];
}

function toGuest(row: GuestRow): Guest {
  // Re-validate stored JSON so an old or tampered row can never break clients.
  const look = lookSchema.safeParse(row.look);
  return { id: row.id, name: row.name, look: look.success ? look.data : DEFAULT_LOOK, candies: cleanCandies(row.candies ?? []) };
}

export class GuestRepository {
  constructor(private readonly pool: Pool) {}

  async findByTokenHash(tokenHash: Buffer): Promise<Guest | null> {
    const { rows } = await this.pool.query<GuestRow>("SELECT id, name, look, candies FROM guests WHERE token_hash = $1", [
      tokenHash,
    ]);
    return rows[0] ? toGuest(rows[0]) : null;
  }

  async create(tokenHash: Buffer, profile: Profile): Promise<Guest> {
    const { rows } = await this.pool.query<GuestRow>(
      "INSERT INTO guests (token_hash, name, look) VALUES ($1, $2, $3) RETURNING id, name, look, candies",
      [tokenHash, profile.name, JSON.stringify(profile.look)],
    );
    return toGuest(rows[0] as GuestRow);
  }

  async updateProfile(id: string, profile: Profile): Promise<Guest> {
    const { rows } = await this.pool.query<GuestRow>(
      "UPDATE guests SET name = $2, look = $3, updated_at = now() WHERE id = $1 RETURNING id, name, look, candies",
      [id, profile.name, JSON.stringify(profile.look)],
    );
    if (!rows[0]) throw new Error("Guest disappeared during update");
    return toGuest(rows[0]);
  }

  /** Atomically adds a candy (no duplicates) and returns the guest's full list. */
  async addCandy(id: string, candy: string): Promise<string[]> {
    const { rows } = await this.pool.query<{ candies: unknown[] }>(
      `UPDATE guests SET candies = CASE WHEN $2 = ANY(candies) THEN candies ELSE array_append(candies, $2) END
       WHERE id = $1 RETURNING candies`,
      [id, candy],
    );
    return cleanCandies(rows[0]?.candies ?? []);
  }

  async touch(id: string): Promise<void> {
    await this.pool.query("UPDATE guests SET last_seen_at = now() WHERE id = $1", [id]);
  }
}
