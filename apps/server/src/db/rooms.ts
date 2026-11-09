import { DOOR_SLOTS, ROOM_FLOORS, type PublicRoom, type RoomAccess, type RoomDecor, type RoomFloor, type RoomGame } from "@ghostel/shared";
import type { Pool } from "./pool";

export interface RoomRecord extends PublicRoom {
  ownerId: string;
}

/** Only for the access check. Never serialise this. */
export interface RoomSecret extends RoomRecord {
  passwordHash: string | null;
}

interface RoomRow {
  id: string;
  owner_id: string;
  owner_name: string;
  name: string;
  access: RoomAccess;
  decor: RoomDecor;
  game: RoomGame;
  floor: RoomFloor;
  slot: string;
  capacity: number;
}

// Public queries list columns explicitly so password_hash can never leak through SELECT *.
const PUBLIC_COLUMNS = "r.id, r.owner_id, g.name AS owner_name, r.name, r.access, r.decor, r.game, r.floor, r.slot, r.capacity";

function toRecord(row: RoomRow): RoomRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    name: row.name,
    access: row.access,
    decor: row.decor,
    game: row.game,
    floor: row.floor,
    slot: row.slot,
    capacity: row.capacity,
  };
}

export function toPublicRoom(room: RoomRecord): PublicRoom {
  return {
    id: room.id,
    name: room.name,
    ownerName: room.ownerName,
    access: room.access,
    decor: room.decor,
    game: room.game,
    floor: room.floor,
    slot: room.slot,
    capacity: room.capacity,
  };
}

/** Thrown by `create` when no requested or free door is left. */
export class NoFreeDoorError extends Error {
  constructor(
    readonly floor: RoomFloor | null,
    readonly slot: string | null,
  ) {
    super("no free door");
  }
}

const UNIQUE_VIOLATION = "23505";

export interface NewRoom {
  name: string;
  access: RoomAccess;
  passwordHash: string | null;
  decor: RoomDecor;
  game: RoomGame;
  capacity: number;
}

export class RoomRepository {
  constructor(private readonly pool: Pool) {}

  async list(limit = 100): Promise<RoomRecord[]> {
    const { rows } = await this.pool.query<RoomRow>(
      `SELECT ${PUBLIC_COLUMNS} FROM rooms r JOIN guests g ON g.id = r.owner_id ORDER BY r.updated_at DESC LIMIT $1`,
      [limit],
    );
    return rows.map(toRecord);
  }

  async find(id: string): Promise<RoomRecord | null> {
    const { rows } = await this.pool.query<RoomRow>(
      `SELECT ${PUBLIC_COLUMNS} FROM rooms r JOIN guests g ON g.id = r.owner_id WHERE r.id = $1`,
      [id],
    );
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async findForEntry(id: string): Promise<RoomSecret | null> {
    const { rows } = await this.pool.query<RoomRow & { password_hash: string | null }>(
      `SELECT ${PUBLIC_COLUMNS}, r.password_hash FROM rooms r JOIN guests g ON g.id = r.owner_id WHERE r.id = $1`,
      [id],
    );
    const row = rows[0];
    return row ? { ...toRecord(row), passwordHash: row.password_hash } : null;
  }

  async countByOwner(ownerId: string): Promise<number> {
    const { rows } = await this.pool.query<{ n: string }>("SELECT count(*) AS n FROM rooms WHERE owner_id = $1", [ownerId]);
    return Number(rows[0]?.n ?? 0);
  }

  /**
   * Puts the room behind a door: the requested one, or the first free door on the floor (or on any
   * floor). The unique (floor, slot) constraint settles races; we just try the next door.
   */
  async create(ownerId: string, room: NewRoom, where: { floor?: RoomFloor; slot?: string } = {}): Promise<RoomRecord> {
    const floors = where.floor ? [where.floor] : ROOM_FLOORS;
    const candidates = floors.flatMap((f) => (where.slot ? [where.slot] : DOOR_SLOTS[f]).map((s) => [f, s] as const));
    const { rows: taken } = await this.pool.query<{ floor: number; slot: string }>("SELECT floor, slot FROM rooms");
    const used = new Set(taken.map((t) => `${t.floor}${t.slot}`));
    for (const [floor, slot] of candidates) {
      if (used.has(`${floor}${slot}`)) continue;
      try {
        const { rows } = await this.pool.query<{ id: string }>(
          `INSERT INTO rooms (owner_id, name, access, password_hash, decor, game, floor, slot, capacity)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [ownerId, room.name, room.access, room.passwordHash, room.decor, room.game, floor, slot, room.capacity],
        );
        return (await this.find((rows[0] as { id: string }).id)) as RoomRecord;
      } catch (error) {
        if ((error as { code?: string }).code !== UNIQUE_VIOLATION) throw error;
      }
    }
    throw new NoFreeDoorError(where.floor ?? null, where.slot ?? null);
  }

  async markUsed(id: string): Promise<void> {
    await this.pool.query("UPDATE rooms SET last_used_at = now() WHERE id = $1", [id]);
  }

  /** Deletes guest rooms nobody used for `days` days, except the ones listed as occupied. Returns their ids. */
  async releaseStale(days: number, exceptOwner: string, occupied: readonly string[]): Promise<string[]> {
    const { rows } = await this.pool.query<{ id: string }>(
      `DELETE FROM rooms WHERE owner_id <> $1 AND last_used_at < now() - make_interval(days => $2)
       AND NOT (id = ANY($3::uuid[])) RETURNING id`,
      [exceptOwner, days, occupied],
    );
    return rows.map((r) => r.id);
  }

  /** `passwordHash` undefined keeps the stored hash. */
  async update(
    id: string,
    patch: { name?: string; access?: RoomAccess; passwordHash?: string | null; decor?: RoomDecor; game?: RoomGame },
  ): Promise<RoomRecord | null> {
    const sets: string[] = [];
    const values: unknown[] = [id];
    const column = { name: "name", access: "access", passwordHash: "password_hash", decor: "decor", game: "game" } as const;
    for (const key of Object.keys(column) as (keyof typeof column)[]) {
      if (patch[key] === undefined) continue;
      values.push(patch[key]);
      sets.push(`${column[key]} = $${values.length}`);
    }
    if (sets.length > 0) {
      await this.pool.query(`UPDATE rooms SET ${sets.join(", ")}, updated_at = now() WHERE id = $1`, values);
    }
    return this.find(id);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query("DELETE FROM rooms WHERE id = $1", [id]);
  }
}
