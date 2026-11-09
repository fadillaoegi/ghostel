import { DEFAULT_LOOK, doorArrival, findDoor, type ServerMessage } from "@ghostel/shared";
import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CONCIERGE_ID, ensureHouseRooms, HOUSE_ROOMS } from "../src/db/house";
import { MIGRATIONS } from "../src/db/migrate";
import { RoomRepository, toPublicRoom } from "../src/db/rooms";
import { api, openSocket, putMe, sessionCookie, startServer, TEST_DATABASE_URL, type TestServer, type TestSocket } from "./helpers";

let server: TestServer;
const sockets: TestSocket[] = [];

beforeAll(async () => {
  server = await startServer({ hub: { snapshotHz: 30 }, roomWritesPerMinute: 10_000 });
});
afterAll(async () => {
  await server.close();
});
beforeEach(async () => {
  await server.pool.query("TRUNCATE guests CASCADE");
  // TRUNCATE bypasses the routes, so reload the hub's door labels from the (now empty) table.
  server.hub.setRooms([]);
});
afterEach(async () => {
  for (const s of sockets.splice(0)) s.ws.terminate();
  await new Promise((r) => setTimeout(r, 50));
});

async function guest(name: string): Promise<string> {
  return sessionCookie((await putMe(server, { name, look: DEFAULT_LOOK })).res) as string;
}

const body = (extra: Record<string, unknown> = {}) => ({ name: "Witching Hour", access: "open", decor: "crypt", game: "none", ...extra });

async function create(cookie: string, extra: Record<string, unknown> = {}) {
  return api(server, "POST", "/api/rooms", cookie, body(extra));
}

async function connect(cookie: string) {
  const s = await openSocket(server, cookie);
  sockets.push(s);
  const welcome = await s.next("welcome");
  return { s, id: welcome.selfId, welcome };
}

function after<T extends ServerMessage["t"]>(s: TestSocket, from: number, type: T, where: (m: Extract<ServerMessage, { t: T }>) => boolean = () => true) {
  const started = Date.now();
  return new Promise<Extract<ServerMessage, { t: T }>>((resolve, reject) => {
    const poll = () => {
      const hit = s.messages.slice(from).find((m) => m.t === type && where(m as Extract<ServerMessage, { t: T }>));
      if (hit) return resolve(hit as Extract<ServerMessage, { t: T }>);
      if (Date.now() - started > 4000) return reject(new Error(`timed out waiting for ${type}`));
      setTimeout(poll, 10);
    };
    poll();
  });
}

async function ride(s: TestSocket, floor: number) {
  const from = s.messages.length;
  s.send({ t: "floor", floor });
  return after(s, from, "welcome");
}

const settle = (ms = 250) => new Promise((r) => setTimeout(r, ms));

describe("room doors", () => {
  it("gives every new room a door code: first free door, or the floor and door asked for", async () => {
    const a = await guest("Ana Alpha");
    const first = await create(a);
    expect(first.res.status).toBe(201);
    expect(first.json?.["room"]).toMatchObject({ floor: 1, slot: "A" });
    const onTwo = await create(a, { name: "Second Room", floor: 2 });
    expect(onTwo.json?.["room"]).toMatchObject({ floor: 2, slot: "A" });
    const picked = await create(a, { name: "Third Room", floor: 2, slot: "E" });
    expect(picked.json?.["room"]).toMatchObject({ floor: 2, slot: "E" });
  });

  it("refuses a taken door and a full floor with 409", async () => {
    const a = await guest("Ana Alpha");
    const b = await guest("Ben Beta");
    expect((await create(a, { floor: 3, slot: "B" })).res.status).toBe(201);
    const taken = await create(b, { name: "Copycat", floor: 3, slot: "B" });
    expect(taken.res.status).toBe(409);
    expect(taken.json).toEqual({ error: "door_taken", message: "Door 3B is already taken. Pick another door." });

    for (const name of ["Room Two", "Room Three"]) expect((await create(a, { name, floor: 3 })).res.status).toBe(201);
    expect((await create(b, { name: "Room Four", floor: 3 })).json?.["room"]).toMatchObject({ floor: 3, slot: "D" });
    const full = await create(b, { name: "Room Five", floor: 3 });
    expect(full.res.status).toBe(409);
    expect(full.json).toEqual({ error: "floor_full", message: "Floor 3 is fully booked. Try another floor." });
  });

  it("rejects doors that do not exist and moving a room", async () => {
    const a = await guest("Ana Alpha");
    expect((await create(a, { floor: 3, slot: "F" })).json).toMatchObject({ field: "slot", message: "Floor 3 has doors A, B, C, D." });
    expect((await create(a, { floor: 4 })).json).toMatchObject({ field: "floor", message: "Rooms are on floors 1, 2 and 3." });
    expect((await create(a, { slot: "A" })).json).toMatchObject({ field: "slot", message: "Pick a floor for that door." });
    const room = (await create(a)).json?.["room"] as { id: string };
    const move = await api(server, "PATCH", `/api/rooms/${room.id}`, a, { floor: 2 });
    expect(move.res.status).toBe(400);
    expect(move.json?.["field"]).toBe("floor");
  });

  it("deleting a room frees its door", async () => {
    const a = await guest("Ana Alpha");
    const room = (await create(a, { floor: 2, slot: "C" })).json?.["room"] as { id: string };
    expect((await api(server, "DELETE", `/api/rooms/${room.id}`, a)).res.status).toBe(204);
    expect((await create(a, { name: "New Tenant", floor: 2, slot: "C" })).res.status).toBe(201);
  });

  it("door labels reach only the guests on that floor, live", async () => {
    const a = await guest("Ana Alpha");
    const second = await connect(await guest("Gil Gallery"));
    const welcome2 = await ride(second.s, 2);
    expect(welcome2.doors.map((d) => d.code)).toEqual(["2A", "2B", "2C", "2D", "2E", "2F"]);
    expect(welcome2.doors.every((d) => d.room === null && d.occupants === 0)).toBe(true);
    const lobby = await connect(await guest("Lou Lobby"));
    expect(lobby.welcome.doors.map((d) => d.code)).toEqual(["1A", "1B", "1C", "1D"]);
    const third = await connect(await guest("Gwen Green"));
    await ride(third.s, 3);
    const marks = [second, lobby, third].map((c) => c.s.messages.length);

    const room = (await create(a, { floor: 2, slot: "B" })).json?.["room"] as { id: string };
    const update = await after(second.s, marks[0] as number, "doors");
    expect(update.doors.find((d) => d.code === "2B")).toMatchObject({ room: { id: room.id, name: "Witching Hour", floor: 2, slot: "B" }, occupants: 0 });
    expect(JSON.stringify(update)).not.toContain("password");

    // Someone walks in: the label counts them.
    const visitor = await connect(a);
    const from = second.s.messages.length;
    visitor.s.send({ t: "enter", room: room.id });
    const counted = await after(second.s, from, "doors", (m) => m.doors.some((d) => d.code === "2B" && d.occupants === 1));
    expect(counted.doors.find((d) => d.code === "2B")?.occupants).toBe(1);

    await settle();
    expect(lobby.s.messages.slice(marks[1]).some((m) => m.t === "doors")).toBe(false);
    expect(third.s.messages.slice(marks[2]).some((m) => m.t === "doors")).toBe(false);
  });

  it("leaving a room puts you in front of its door on its floor", async () => {
    const a = await guest("Ana Alpha");
    const room = (await create(a, { floor: 2, slot: "B" })).json?.["room"] as { id: string };
    const c = await connect(a);
    let from = c.s.messages.length;
    c.s.send({ t: "enter", room: room.id });
    await after(c.s, from, "welcome", (m) => m.place.kind === "room");

    from = c.s.messages.length;
    c.s.send({ t: "exit" });
    const out = await after(c.s, from, "welcome");
    expect(out.place).toEqual({ kind: "floor", floor: 2 });
    const me = out.players.find((p) => p.id === out.selfId);
    const arrival = doorArrival(findDoor(2, "B") as NonNullable<ReturnType<typeof findDoor>>);
    expect(me).toMatchObject({ x: arrival.x, z: arrival.z });
    expect(out.doors.map((d) => d.code)).toContain("2B");
  });

  it("house rooms sit behind doors 1A, 1B and 1C", async () => {
    await ensureHouseRooms(server.pool);
    const cookie = await guest("Hal House");
    const rooms = (await api(server, "GET", "/api/rooms", cookie)).json?.["rooms"] as { id: string; floor: number; slot: string }[];
    for (const house of HOUSE_ROOMS) expect(rooms.find((r) => r.id === house.id)).toMatchObject({ floor: 1, slot: house.slot });
    // The only free lobby door left is 1D.
    expect((await create(cookie)).json?.["room"]).toMatchObject({ floor: 1, slot: "D" });
    expect((await create(cookie, { name: "Lobby Again", floor: 1 })).res.status).toBe(409);
  });

  it("releases guest rooms nobody used for days, but never house rooms or occupied rooms", async () => {
    await ensureHouseRooms(server.pool);
    const a = await guest("Ana Alpha");
    const stale = (await create(a, { name: "Dusty Attic", floor: 2 })).json?.["room"] as { id: string };
    const busy = (await create(a, { name: "Busy Bee", floor: 2 })).json?.["room"] as { id: string };
    const fresh = (await create(a, { name: "Fresh Paint", floor: 2 })).json?.["room"] as { id: string };
    await server.pool.query("UPDATE rooms SET last_used_at = now() - interval '10 days' WHERE id <> $1", [fresh.id]);

    const repo = new RoomRepository(server.pool);
    const released = await repo.releaseStale(3, CONCIERGE_ID, [busy.id]);
    expect(released).toEqual([stale.id]);
    const { rows } = await server.pool.query<{ id: string }>("SELECT id FROM rooms");
    const left = rows.map((r) => r.id).sort();
    expect(left).toEqual([...HOUSE_ROOMS.map((h) => h.id), busy.id, fresh.id].sort());
  });

  it("entering a room marks it as used", async () => {
    const a = await guest("Ana Alpha");
    const room = (await create(a)).json?.["room"] as { id: string };
    await server.pool.query("UPDATE rooms SET last_used_at = now() - interval '10 days'");
    const c = await connect(a);
    const from = c.s.messages.length;
    c.s.send({ t: "enter", room: room.id });
    await after(c.s, from, "welcome", (m) => m.place.kind === "room");
    await settle(100);
    const { rows } = await server.pool.query<{ fresh: boolean }>(
      "SELECT last_used_at > now() - interval '1 minute' AS fresh FROM rooms WHERE id = $1",
      [room.id],
    );
    expect(rows[0]?.fresh).toBe(true);
  });

  it("the hub's room list matches the database after a restart", async () => {
    const a = await guest("Ana Alpha");
    await create(a, { floor: 3, slot: "C" });
    server.hub.setRooms((await new RoomRepository(server.pool).list(200)).map(toPublicRoom));
    expect(server.hub.doorsFor(3).find((d) => d.code === "3C")?.room).toMatchObject({ name: "Witching Hour" });
  });
});

describe("migration 004_room_doors", () => {
  const schema = "ghostel_migration_004";
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: TEST_DATABASE_URL });
    await client.connect();
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}, public`);
  });
  afterAll(async () => {
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
  });

  it("gives existing rooms doors, house rooms first, and removes rooms that do not fit", async () => {
    const before = MIGRATIONS.slice(0, MIGRATIONS.findIndex((m) => m.id === "004_room_doors"));
    for (const m of before) await client.query(m.sql);

    const look = JSON.stringify(DEFAULT_LOOK);
    await client.query("INSERT INTO guests (id, token_hash, name, look) VALUES ($1, '\\x01', 'Concierge', $2)", [CONCIERGE_ID, look]);
    const { rows: g } = await client.query<{ id: string }>(
      "INSERT INTO guests (token_hash, name, look) VALUES ('\\x02', 'Guest', $1) RETURNING id",
      [look],
    );
    const guestId = g[0]?.id as string;
    // 16 guest rooms created before the house rooms, then 3 house rooms: 19 rooms, 14 doors.
    for (let i = 0; i < 16; i++) {
      await client.query(
        "INSERT INTO rooms (owner_id, name, access, decor, game, created_at) VALUES ($1, $2, 'open', 'crypt', 'none', now() - make_interval(hours => $3))",
        [guestId, `Guest Room ${i}`, 100 - i],
      );
    }
    for (const house of HOUSE_ROOMS) {
      await client.query("INSERT INTO rooms (id, owner_id, name, access, decor, game) VALUES ($1, $2, $3, 'open', $4, $5)", [
        house.id,
        CONCIERGE_ID,
        house.name,
        house.decor,
        house.game,
      ]);
    }

    const m004 = MIGRATIONS.find((m) => m.id === "004_room_doors");
    await client.query((m004 as { sql: string }).sql);

    const { rows } = await client.query<{ id: string; name: string; floor: number; slot: string }>(
      "SELECT id, name, floor, slot FROM rooms ORDER BY floor, slot",
    );
    expect(rows).toHaveLength(14);
    expect(rows.slice(0, 3).map((r) => r.id)).toEqual(HOUSE_ROOMS.map((h) => h.id));
    expect(rows.slice(0, 3).map((r) => `${r.floor}${r.slot}`)).toEqual(["1A", "1B", "1C"]);
    // Oldest guest rooms keep a door; the 5 newest do not fit.
    expect(rows.slice(3).map((r) => r.name)).toEqual(Array.from({ length: 11 }, (_, i) => `Guest Room ${i}`));
    await expect(
      client.query("INSERT INTO rooms (owner_id, name, access, decor, game, floor, slot) VALUES ($1, 'Clash', 'open', 'crypt', 'none', 1, 'A')", [guestId]),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      client.query("INSERT INTO rooms (owner_id, name, access, decor, game, floor, slot) VALUES ($1, 'Nowhere', 'open', 'crypt', 'none', 3, 'F')", [guestId]),
    ).rejects.toMatchObject({ code: "23514" });
  });
});
