// Empties the E2E database before Playwright starts the server.
// Refuses to run against anything whose database name does not end in "_test".
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const dbName = new URL(url).pathname.slice(1);
if (!dbName.endsWith("_test")) {
  console.error(`Refusing to reset "${dbName}": only *_test databases may be reset.`);
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(`DO $$ BEGIN
  IF to_regclass('public.guests') IS NOT NULL THEN TRUNCATE guests CASCADE; END IF;
END $$;`);
await client.end();
console.log(`Reset ${dbName}`);
