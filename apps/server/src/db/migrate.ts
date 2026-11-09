import type { Pool } from "./pool";

/** Ordered, append-only migrations. Never edit one that has shipped; add a new entry. */
export const MIGRATIONS: readonly { id: string; sql: string }[] = [
  {
    id: "001_guests",
    sql: `
      CREATE TABLE guests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        token_hash bytea NOT NULL UNIQUE,
        name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 20),
        look jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now()
      );
    `,
  },
  {
    id: "002_rooms",
    sql: `
      CREATE TABLE rooms (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
        name text NOT NULL CHECK (char_length(name) BETWEEN 3 AND 30),
        access text NOT NULL CHECK (access IN ('open', 'locked', 'password')),
        password_hash text,
        decor text NOT NULL CHECK (decor IN ('crypt', 'library', 'ballroom')),
        game text NOT NULL CHECK (game IN ('none', 'pumpkin_trivia')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT password_matches_access CHECK ((access = 'password') = (password_hash IS NOT NULL))
      );
      CREATE INDEX rooms_owner_idx ON rooms (owner_id);
    `,
  },
  {
    id: "003_candies",
    sql: `ALTER TABLE guests ADD COLUMN candies text[] NOT NULL DEFAULT '{}';`,
  },
  {
    // Rooms move behind numbered doors: 1A–1D, 2A–2F, 3A–3D. Existing rooms (house rooms first)
    // take free doors in order; rooms that do not fit are removed.
    id: "004_room_doors",
    sql: `
      ALTER TABLE rooms ADD COLUMN floor smallint, ADD COLUMN slot text, ADD COLUMN last_used_at timestamptz NOT NULL DEFAULT now();
      DO $$
      DECLARE r record; free record;
      BEGIN
        FOR r IN SELECT id FROM rooms ORDER BY (owner_id = '00000000-0000-4000-8000-00000000c0de') DESC, created_at LOOP
          SELECT v.f, v.s INTO free FROM (VALUES
            (1,'A',1),(1,'B',2),(1,'C',3),(1,'D',4),
            (2,'A',5),(2,'B',6),(2,'C',7),(2,'D',8),(2,'E',9),(2,'F',10),
            (3,'A',11),(3,'B',12),(3,'C',13),(3,'D',14)) AS v(f, s, o)
          WHERE NOT EXISTS (SELECT 1 FROM rooms x WHERE x.floor = v.f AND x.slot = v.s)
          ORDER BY v.o LIMIT 1;
          IF NOT FOUND THEN
            DELETE FROM rooms WHERE id = r.id;
          ELSE
            UPDATE rooms SET floor = free.f, slot = free.s WHERE id = r.id;
          END IF;
        END LOOP;
      END $$;
      ALTER TABLE rooms ALTER COLUMN floor SET NOT NULL, ALTER COLUMN slot SET NOT NULL;
      ALTER TABLE rooms ADD CONSTRAINT rooms_door_check CHECK (
        (floor = 1 AND slot IN ('A','B','C','D')) OR
        (floor = 2 AND slot IN ('A','B','C','D','E','F')) OR
        (floor = 3 AND slot IN ('A','B','C','D')));
      ALTER TABLE rooms ADD CONSTRAINT rooms_door_unique UNIQUE (floor, slot);
    `,
  },
  {
    // Rooms hold 2–8 guests, chosen when the room is created; existing rooms keep 8.
    id: "005_room_capacity",
    sql: `ALTER TABLE rooms ADD COLUMN capacity smallint NOT NULL DEFAULT 8 CONSTRAINT rooms_capacity_check CHECK (capacity BETWEEN 2 AND 8);`,
  },
];

const LOCK_KEY = 47_011_001; // arbitrary constant for pg_advisory_lock

export async function migrate(pool: Pool): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const { rows } = await client.query<{ id: string }>("SELECT id FROM schema_migrations");
    const done = new Set(rows.map((r) => r.id));
    for (const m of MIGRATIONS) {
      if (done.has(m.id)) continue;
      await client.query("BEGIN");
      try {
        await client.query(m.sql);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [m.id]);
        await client.query("COMMIT");
        applied.push(m.id);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => undefined);
    client.release();
  }
  return applied;
}
