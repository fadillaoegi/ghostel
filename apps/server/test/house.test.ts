import { DEFAULT_LOOK } from "@ghostel/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CONCIERGE_ID, ensureHouseRooms, HOUSE_ROOMS } from "../src/db/house";
import { api, putMe, sessionCookie, startServer, type TestServer } from "./helpers";

// No TRUNCATE here: this file checks what startup seeds.
let server: TestServer;

beforeAll(async () => {
  server = await startServer();
  // Guest rooms left by an earlier test file may sit behind doors 1A–1C; in production the house
  // rooms always take those doors first (migration 004 and the seed on every start).
  const { rowCount } = await server.pool.query("DELETE FROM rooms WHERE owner_id <> $1 AND floor = 1", [CONCIERGE_ID]);
  if (rowCount) await ensureHouseRooms(server.pool);
});
afterAll(async () => {
  await server.close();
});

describe("house rooms", () => {
  it("are listed for every guest, open, and owned by the Concierge", async () => {
    const cookie = sessionCookie((await putMe(server, { name: "First Timer", look: DEFAULT_LOOK })).res) as string;
    const rooms = (await api(server, "GET", "/api/rooms", cookie)).json?.["rooms"] as { id: string; name: string; ownerName: string; access: string; mine: boolean }[];
    for (const house of HOUSE_ROOMS) {
      expect(rooms.find((r) => r.id === house.id)).toMatchObject({ name: house.name, ownerName: "The Concierge", access: "open", mine: false });
    }
  });

  it("cannot be changed or deleted by guests", async () => {
    const cookie = sessionCookie((await putMe(server, { name: "Sneaky Sam", look: DEFAULT_LOOK })).res) as string;
    const id = HOUSE_ROOMS[0]?.id as string;
    expect((await api(server, "PATCH", `/api/rooms/${id}`, cookie, { access: "locked" })).res.status).toBe(403);
    expect((await api(server, "DELETE", `/api/rooms/${id}`, cookie)).res.status).toBe(403);
  });

  it("seeding is idempotent", async () => {
    await ensureHouseRooms(server.pool);
    await ensureHouseRooms(server.pool);
    const { rows } = await server.pool.query("SELECT count(*)::int AS n FROM rooms WHERE owner_id = '00000000-0000-4000-8000-00000000c0de'");
    expect(rows[0].n).toBe(HOUSE_ROOMS.length);
  });
});
