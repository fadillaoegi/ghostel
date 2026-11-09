import { DEFAULT_LOOK, type ServerMessage } from "@ghostel/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { api, openSocket, putMe, sessionCookie, startServer, type TestServer, type TestSocket } from "./helpers";

let server: TestServer;
const sockets: TestSocket[] = [];

beforeAll(async () => {
  server = await startServer({ hub: { snapshotHz: 30 }, roomWritesPerMinute: 10_000, passwordAttemptsPerMinute: 3 });
});
afterAll(async () => {
  await server.close();
});
beforeEach(async () => {
  await server.pool.query("TRUNCATE guests CASCADE");
});
afterEach(async () => {
  for (const s of sockets.splice(0)) s.ws.terminate();
  await new Promise((r) => setTimeout(r, 50));
});

const PASSWORD = "Pumpkin Spice 42";

async function guest(name: string): Promise<string> {
  return sessionCookie((await putMe(server, { name, look: DEFAULT_LOOK })).res) as string;
}

async function createRoom(cookie: string, body: Record<string, unknown> = {}) {
  const res = await api(server, "POST", "/api/rooms", cookie, {
    name: "Pumpkin Patch",
    access: "open",
    decor: "crypt",
    game: "pumpkin_trivia",
    ...body,
  });
  expect(res.res.status).toBe(201);
  return res.json?.["room"] as { id: string; name: string };
}

async function connect(cookie: string) {
  const s = await openSocket(server, cookie);
  sockets.push(s);
  const welcome = await s.next("welcome");
  return { s, selfId: welcome.selfId };
}

/** Sends `enter` and resolves with the welcome or the failure, whichever comes next. */
function enter(s: TestSocket, room: string, password?: string) {
  const before = s.messages.length;
  s.send(password === undefined ? { t: "enter", room } : { t: "enter", room, password });
  return new Promise<ServerMessage>((resolve, reject) => {
    const started = Date.now();
    const poll = () => {
      const m = s.messages.slice(before).find((x) => x.t === "welcome" || x.t === "enter_failed");
      if (m) return resolve(m);
      if (Date.now() - started > 4000) return reject(new Error("no answer to enter"));
      setTimeout(poll, 10);
    };
    poll();
  });
}

const settle = () => new Promise((r) => setTimeout(r, 250));

describe("room API", () => {
  it("requires a session", async () => {
    expect((await api(server, "GET", "/api/rooms")).res.status).toBe(401);
    expect((await api(server, "POST", "/api/rooms", undefined, { name: "Nope" })).res.status).toBe(401);
  });

  it("creates and lists rooms without ever exposing the password or its hash", async () => {
    const owner = await guest("Olga Owner");
    const room = await createRoom(owner, { access: "password", password: PASSWORD });
    const other = await guest("Vic Visitor");

    for (const cookie of [owner, other]) {
      const list = await api(server, "GET", "/api/rooms", cookie);
      expect(list.json?.["rooms"]).toEqual([
        {
          id: room.id,
          name: "Pumpkin Patch",
          ownerName: "Olga Owner",
          access: "password",
          decor: "crypt",
          game: "pumpkin_trivia",
          floor: 1,
          slot: "A",
          capacity: 8,
          occupants: 0,
          mine: cookie === owner,
        },
      ]);
    }

    const { rows } = await server.pool.query<{ password_hash: string }>("SELECT password_hash FROM rooms");
    const hash = rows[0]?.password_hash as string;
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(hash).not.toContain(PASSWORD);
    for (const cookie of [owner, other]) {
      const text = (await api(server, "GET", "/api/rooms", cookie)).text;
      expect(text).not.toContain(PASSWORD);
      expect(text).not.toContain("argon2");
      expect(text).not.toContain("password_hash");
    }
  });

  it("rooms hold 2–8 guests, chosen when created", async () => {
    const owner = await guest("Olga Owner");
    const base = { name: "Tiny Tomb", access: "open", decor: "crypt", game: "none" };
    expect((await api(server, "POST", "/api/rooms", owner, { ...base, capacity: 1 })).json).toMatchObject({ field: "capacity", message: "Rooms hold 2 to 8 guests." });
    expect((await api(server, "POST", "/api/rooms", owner, { ...base, capacity: 9 })).res.status).toBe(400);
    expect((await api(server, "POST", "/api/rooms", owner, { ...base, capacity: 2.5 })).res.status).toBe(400);
    const room = (await api(server, "POST", "/api/rooms", owner, { ...base, capacity: 2 })).json?.["room"];
    expect(room).toMatchObject({ capacity: 2 });
    const resize = await api(server, "PATCH", `/api/rooms/${room.id}`, owner, { capacity: 4 });
    expect(resize.json).toMatchObject({ field: "capacity", message: "A room's size is set when it is created." });
  });

  it("validates input with field-specific messages", async () => {
    const owner = await guest("Olga Owner");
    const bad = await api(server, "POST", "/api/rooms", owner, { name: "ab", access: "open", decor: "crypt", game: "none" });
    expect(bad.res.status).toBe(400);
    expect(bad.json).toEqual({ error: "invalid_room", field: "name", message: "Room names need at least 3 characters." });
    const noPassword = await api(server, "POST", "/api/rooms", owner, { name: "Vault", access: "password", decor: "crypt", game: "none" });
    expect(noPassword.json).toMatchObject({ field: "password", message: "Set a password for this room." });
    const sneaky = await api(server, "POST", "/api/rooms", owner, { name: "Vault", access: "open", decor: "crypt", game: "none", owner_id: "x" });
    expect(sneaky.res.status).toBe(400);
  });

  it("limits rooms per guest", async () => {
    const owner = await guest("Olga Owner");
    for (let i = 0; i < 3; i++) await createRoom(owner, { name: `Room ${i}` });
    const fourth = await api(server, "POST", "/api/rooms", owner, { name: "Room 4", access: "open", decor: "crypt", game: "none" });
    expect(fourth.res.status).toBe(409);
    expect(fourth.json?.["message"]).toBe("You can own at most 3 rooms. Delete one first.");
  });

  it("only the owner can change or delete a room", async () => {
    const owner = await guest("Olga Owner");
    const other = await guest("Vic Visitor");
    const room = await createRoom(owner);

    const hijack = await api(server, "PATCH", `/api/rooms/${room.id}`, other, { name: "Mine Now" });
    expect(hijack.res.status).toBe(403);
    expect(hijack.json?.["message"]).toBe("Only the room's owner can change it.");
    expect((await api(server, "DELETE", `/api/rooms/${room.id}`, other)).res.status).toBe(403);

    const renamed = await api(server, "PATCH", `/api/rooms/${room.id}`, owner, { name: "Haunted Library", decor: "library" });
    expect(renamed.json?.["room"]).toMatchObject({ name: "Haunted Library", decor: "library", mine: true });

    expect((await api(server, "PATCH", "/api/rooms/not-a-uuid", owner, { name: "Whatever" })).res.status).toBe(404);
    expect((await api(server, "PATCH", "/api/rooms/00000000-0000-4000-8000-000000000000", owner, { name: "Ghost" })).res.status).toBe(404);
    expect((await api(server, "DELETE", `/api/rooms/${room.id}`, owner)).res.status).toBe(204);
    expect((await api(server, "GET", "/api/rooms", owner)).json?.["rooms"]).toEqual([]);
  });

  it("switching to password access needs a password, switching away clears it", async () => {
    const owner = await guest("Olga Owner");
    const room = await createRoom(owner);
    const missing = await api(server, "PATCH", `/api/rooms/${room.id}`, owner, { access: "password" });
    expect(missing.json).toMatchObject({ field: "password", message: "Set a password for this room." });
    expect((await api(server, "PATCH", `/api/rooms/${room.id}`, owner, { access: "password", password: PASSWORD })).res.status).toBe(200);
    expect((await api(server, "PATCH", `/api/rooms/${room.id}`, owner, { access: "open" })).res.status).toBe(200);
    const { rows } = await server.pool.query("SELECT password_hash FROM rooms");
    expect(rows).toEqual([{ password_hash: null }]);
  });
});

describe("entering rooms", () => {
  it("open rooms: enter, see each other, come back to the lobby", async () => {
    const owner = await guest("Olga Owner");
    const room = await createRoom(owner);
    const a = await connect(owner);
    const b = await connect(await guest("Vic Visitor"));

    const aIn = await enter(a.s, room.id);
    expect(aIn).toMatchObject({ t: "welcome", place: { kind: "room", owner: true, room: { id: room.id, name: "Pumpkin Patch" } } });
    // Lobby guests see the owner leave the lobby.
    expect((await b.s.next("leave", (m) => m.id === a.selfId)).id).toBe(a.selfId);

    const bIn = await enter(b.s, room.id);
    expect(bIn).toMatchObject({ t: "welcome", place: { kind: "room", owner: false } });
    if (bIn.t !== "welcome") throw new Error("expected welcome");
    expect(bIn.players.map((p) => p.name).sort()).toEqual(["Olga Owner", "Vic Visitor"]);
    expect((await api(server, "GET", "/api/rooms", owner)).json?.["rooms"][0].occupants).toBe(2);

    b.s.send({ t: "exit" });
    await b.s.next("welcome", (m) => m.place.kind === "lobby");
    expect((await a.s.next("leave", (m) => m.id === b.selfId)).id).toBe(b.selfId);
  });

  it("locked rooms: only the owner gets in, guests already inside stay", async () => {
    const owner = await guest("Olga Owner");
    const room = await createRoom(owner);
    const a = await connect(owner);
    const insider = await connect(await guest("Ingrid Insider"));
    const outsider = await connect(await guest("Otto Outsider"));
    await enter(insider.s, room.id);

    expect((await api(server, "PATCH", `/api/rooms/${room.id}`, owner, { access: "locked" })).res.status).toBe(200);
    expect((await insider.s.next("room")).room.access).toBe("locked");

    expect(await enter(outsider.s, room.id)).toEqual({ t: "enter_failed", code: "locked", message: "This room is locked by its owner." });
    expect(await enter(a.s, room.id)).toMatchObject({ t: "welcome", place: { kind: "room", owner: true } });
    expect((await api(server, "GET", "/api/rooms", owner)).json?.["rooms"][0].occupants).toBe(2);
  });

  it("password rooms: required, wrong, right, and throttled guessing", async () => {
    const owner = await guest("Olga Owner");
    const room = await createRoom(owner, { access: "password", password: PASSWORD });
    const v = await connect(await guest("Vic Visitor"));

    expect(await enter(v.s, room.id)).toMatchObject({ t: "enter_failed", code: "password_required" });
    expect(await enter(v.s, room.id, "pumpkin spice 42")).toEqual({ t: "enter_failed", code: "wrong_password", message: "Wrong password." });
    expect(await enter(v.s, room.id, ` ${PASSWORD}`)).toMatchObject({ code: "wrong_password" });
    const inside = await enter(v.s, room.id, PASSWORD);
    expect(inside).toMatchObject({ t: "welcome", place: { kind: "room" } });
    // Nothing the server sent contains the password.
    expect(JSON.stringify(v.s.messages)).not.toContain(PASSWORD);

    // A second guesser hits the limit (3 per minute in this test server), even with the right password.
    const g = await connect(await guest("Gus Guesser"));
    for (const guess of ["1111", "2222", "3333"]) expect(await enter(g.s, room.id, guess)).toMatchObject({ code: "wrong_password" });
    expect(await enter(g.s, room.id, PASSWORD)).toMatchObject({ code: "too_many_attempts" });
    // The owner never needs the password.
    expect(await enter((await connect(owner)).s, room.id)).toMatchObject({ t: "welcome" });
  });

  it("isolates chat and movement between the lobby and rooms", async () => {
    const owner = await guest("Olga Owner");
    const room = await createRoom(owner, { access: "password", password: PASSWORD });
    const inside = await connect(owner);
    const lobby = await connect(await guest("Larry Lobby"));
    await enter(inside.s, room.id);
    const mark = lobby.s.messages.length;

    inside.s.send({ t: "chat", text: "secret plans in the crypt" });
    await inside.s.next("chat");
    inside.s.send({ t: "move", x: 0.3, z: 4.5, ry: 0 });
    lobby.s.send({ t: "chat", text: "lobby gossip" });
    await lobby.s.next("chat");
    await settle();

    const leaked = lobby.s.messages.slice(mark);
    expect(JSON.stringify(leaked)).not.toContain("secret plans");
    expect(leaked.some((m) => m.t === "snap" && m.p.some(([id]) => id === inside.selfId))).toBe(false);
    expect(JSON.stringify(inside.s.messages)).not.toContain("lobby gossip");

    // A guest who joins the room later sees the room history, not the lobby's.
    const late = await connect(owner);
    const welcome = await enter(late.s, room.id);
    if (welcome.t !== "welcome") throw new Error("expected welcome");
    expect(welcome.chat.map((m) => m.text)).toEqual(["secret plans in the crypt"]);
  });

  it("room movement uses the room's walls", async () => {
    const owner = await guest("Olga Owner");
    const room = await createRoom(owner);
    const a = await connect(owner);
    const w = await enter(a.s, room.id);
    if (w.t !== "welcome") throw new Error("expected welcome");
    for (let i = 0; i < 20; i++) {
      a.s.send({ t: "move", x: 50, z: 4, ry: 0 });
      await new Promise((r) => setTimeout(r, 30));
    }
    const corrections = a.s.messages.filter((m): m is Extract<ServerMessage, { t: "correct" }> => m.t === "correct");
    expect(Math.max(...corrections.map((c) => c.x))).toBeLessThanOrEqual(8 - 0.4 + 0.01);
  });

  it("deleting a room sends everyone inside back out through its door", async () => {
    const owner = await guest("Olga Owner");
    const room = await createRoom(owner);
    const v = await connect(await guest("Vic Visitor"));
    await enter(v.s, room.id);
    expect((await api(server, "DELETE", `/api/rooms/${room.id}`, owner)).res.status).toBe(204);
    expect((await v.s.next("welcome", (m) => m.place.kind === "lobby")).place).toEqual({ kind: "lobby" });
    expect((await v.s.next("notice")).message).toBe("The owner closed this room. Back to the hall!");
    expect(await enter(v.s, room.id)).toMatchObject({ code: "not_found" });
  });

  it("rejects malformed room ids without touching the database", async () => {
    const v = await connect(await guest("Vic Visitor"));
    expect(await enter(v.s, "'; DROP TABLE rooms; --")).toMatchObject({ code: "not_found" });
    expect((await server.pool.query("SELECT to_regclass('rooms') AS t")).rows[0].t).toBe("rooms");
  });
});
