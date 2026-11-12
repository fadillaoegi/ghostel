import { DEFAULT_LOOK, FLOOR_TABLES, SDP_MAX, roomTable, standSpot, type ServerMessage } from "@ghostel/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { api, openSocket, putMe, sessionCookie, startServer, type TestServer, type TestSocket } from "./helpers";

let server: TestServer;
const sockets: TestSocket[] = [];

beforeAll(async () => {
  server = await startServer({ hub: { maxConnectionsPerGuest: 10, snapshotHz: 30 }, roomWritesPerMinute: 10_000 });
});
afterAll(async () => {
  await server.close();
});
beforeEach(async () => {
  await server.pool.query("TRUNCATE guests CASCADE");
  server.hub.setRooms([]);
});
afterEach(async () => {
  for (const s of sockets.splice(0)) s.ws.terminate();
  await new Promise((r) => setTimeout(r, 50));
});

const OFFER = { kind: "offer", sdp: "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n" } as const;
const settle = (ms = 250) => new Promise((r) => setTimeout(r, ms));

async function guest(name: string): Promise<string> {
  return sessionCookie((await putMe(server, { name, look: DEFAULT_LOOK })).res) as string;
}

async function connect(cookie: string) {
  const s = await openSocket(server, cookie);
  sockets.push(s);
  const welcome = await s.next("welcome");
  const me = welcome.players.find((p) => p.id === welcome.selfId);
  return { s, id: welcome.selfId, pos: { x: me?.x ?? 0, z: me?.z ?? 0 }, welcome };
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

/** Walks in small steps inside the server's speed budget. */
async function walk(s: TestSocket, from: { x: number; z: number }, to: { x: number; z: number }) {
  let { x, z } = from;
  while (Math.hypot(to.x - x, to.z - z) > 0.05) {
    const d = Math.hypot(to.x - x, to.z - z);
    const k = Math.min(1, 0.18 / d);
    x += (to.x - x) * k;
    z += (to.z - z) * k;
    s.send({ t: "move", x, z, ry: 0 });
    await new Promise((r) => setTimeout(r, 40));
  }
  await settle(120);
  return { x, z };
}

const lobbyTable = FLOOR_TABLES[1].find((t) => t.id === "t3")!; // a table for two, west of the carpet
const otherTable = FLOOR_TABLES[1].find((t) => t.id === "t4")!;
const spotOf = (t: typeof lobbyTable, i: number) => standSpot(t, t.seats[i]!);

/** Walks from the front door to a lobby chair (around the table) and sits down. */
async function sitAt(c: Awaited<ReturnType<typeof connect>>, table: typeof lobbyTable, seat: number) {
  const spot = spotOf(table, seat);
  const via = { x: spot.x, z: 7.6 };
  await walk(c.s, c.pos, via);
  c.pos = await walk(c.s, via, spot);
  const mark = c.s.messages.length;
  c.s.send({ t: "sit", table: table.id, seat });
  return after(c.s, mark, "seat", (m) => m.id === c.id && m.table === table.id);
}

describe("seats", () => {
  it("needs a free chair within reach; standing puts you just outside it", async () => {
    const a = await connect(await guest("Ana"));
    const b = await connect(await guest("Ben"));
    const mark = a.s.messages.length;
    a.s.send({ t: "sit", table: "t3", seat: 1 }); // from the front door: too far
    expect(await after(a.s, mark, "seat_denied")).toEqual({ t: "seat_denied", message: "Walk up to the chair first." });

    expect(await sitAt(a, lobbyTable, 1)).toEqual({ t: "seat", id: a.id, table: "t3", seat: 1 });
    expect(await b.s.next("seat", (m) => m.id === a.id)).toMatchObject({ table: "t3", seat: 1 });
    const call = await a.s.next("call", (m) => m.call !== null);
    expect(call.call).toEqual({ kind: "table", table: "t3", members: [{ id: a.id, name: "Ana", mic: false, cam: null, screen: null, seat: 1 }] });

    // The chair is taken.
    const spot = spotOf(lobbyTable, 1);
    await walk(b.s, b.pos, { x: spot.x, z: 7.6 });
    b.pos = await walk(b.s, { x: spot.x, z: 7.6 }, { x: spot.x + 0.3, z: spot.z + 0.3 });
    const bMark = b.s.messages.length;
    b.s.send({ t: "sit", table: "t3", seat: 1 });
    expect(await after(b.s, bMark, "seat_denied")).toEqual({ t: "seat_denied", message: "Someone is already sitting there." });

    // Moves are ignored while seated; a late visitor sees the guest on the chair.
    a.s.send({ t: "move", x: 3, z: 3, ry: 0 });
    await settle();
    const c = await connect(await guest("Cleo"));
    const seated = c.welcome.players.find((p) => p.id === a.id);
    expect(seated?.seat).toEqual({ table: "t3", seat: 1 });
    expect(seated?.x).toBeCloseTo(lobbyTable.seats[1]!.x, 2);
    expect(seated?.z).toBeCloseTo(lobbyTable.seats[1]!.z, 2);

    const standMark = a.s.messages.length;
    a.s.send({ t: "stand" });
    const correct = await after(a.s, standMark, "correct");
    expect(correct.x).toBeCloseTo(spot.x, 1);
    expect(correct.z).toBeCloseTo(spot.z, 1);
    expect(await after(a.s, standMark, "call")).toEqual({ t: "call", call: null });
    expect(await c.s.next("seat", (m) => m.id === a.id && m.table === null)).toMatchObject({ seat: null });
  });

  it("unknown tables and chairs are invalid messages", async () => {
    const a = await connect(await guest("Hacker Hal"));
    for (let i = 0; i < 20; i++) a.s.send({ t: "sit", table: "t99", seat: 0 });
    expect((await a.s.closed).code).toBe(4001);
  });
});

describe("table calls", () => {
  it("contain exactly the guests at that table; signals and media stay inside", async () => {
    const a = await connect(await guest("Ana"));
    const b = await connect(await guest("Ben"));
    const c = await connect(await guest("Cleo"));
    const d = await connect(await guest("Dan"));
    await sitAt(a, lobbyTable, 1);
    await sitAt(b, lobbyTable, 0);
    await sitAt(d, otherTable, 0);
    const both = await a.s.next("call", (m) => (m.call?.members.length ?? 0) === 2);
    expect(both.call?.members.map((m) => m.name).sort()).toEqual(["Ana", "Ben"]);
    expect((await d.s.next("call", (m) => m.call !== null)).call?.members.map((m) => m.name)).toEqual(["Dan"]);

    for (const to of [b.id, c.id, d.id]) a.s.send({ t: "signal", to, data: OFFER });
    expect(await b.s.next("signal")).toEqual({ t: "signal", from: a.id, data: OFFER });

    const mark = b.s.messages.length;
    a.s.send({ t: "media", mic: true, cam: "cam-stream-1", screen: "screen-stream-1" });
    const update = await after(b.s, mark, "call", (m) => m.call?.members.some((x) => x.id === a.id && x.mic) ?? false);
    // Screen sharing needs an approved presenter in a room.
    expect(update.call?.members.find((x) => x.id === a.id)).toMatchObject({ mic: true, cam: "cam-stream-1", screen: null });

    await settle();
    expect(c.s.messages.some((m) => m.t === "signal" || m.t === "call")).toBe(false);
    expect(d.s.messages.some((m) => m.t === "signal")).toBe(false);
    expect(JSON.stringify(d.s.messages)).not.toContain("cam-stream-1");
  });

  it("closing the tab or riding the elevator frees the seat and ends the call", async () => {
    const a = await connect(await guest("Ana"));
    const b = await connect(await guest("Ben"));
    const watcher = await connect(await guest("Wally"));
    await sitAt(a, lobbyTable, 1);
    await sitAt(b, lobbyTable, 0);
    await a.s.next("call", (m) => (m.call?.members.length ?? 0) === 2);

    const closeMark = a.s.messages.length;
    const watchMark = watcher.s.messages.length;
    b.s.ws.close();
    expect((await after(a.s, closeMark, "call", (m) => m.call?.members.length === 1)).call?.members.map((m) => m.id)).toEqual([a.id]);
    expect(await after(watcher.s, watchMark, "seat", (m) => m.id === b.id)).toMatchObject({ table: null });

    const mark = a.s.messages.length;
    a.s.send({ t: "floor", floor: 2 });
    await after(a.s, mark, "welcome", (m) => m.place.kind === "floor");
    expect(await after(a.s, mark, "call")).toEqual({ t: "call", call: null });
    expect(await after(watcher.s, watchMark, "seat", (m) => m.id === a.id && m.table === null)).toMatchObject({ seat: null });
    // The chair is free again.
    const c = await connect(await guest("Cleo"));
    expect(await sitAt(c, lobbyTable, 1)).toMatchObject({ id: c.id, seat: 1 });
  });
});

describe("room calls", () => {
  it("a room's call is its long table: only seated guests are in it; standing up leaves it (M20)", async () => {
    const owner = await guest("Olga");
    const created = await api(server, "POST", "/api/rooms", owner, { name: "Small Talk", access: "open", decor: "crypt", game: "none", capacity: 3 });
    expect(created.json?.["room"]).toMatchObject({ capacity: 3 });
    const roomId = created.json?.["room"].id as string;
    const o = await connect(owner);
    const v = await connect(await guest("Vic"));
    const w = await connect(await guest("Wes"));
    const entered = new Map<typeof o, number>();
    for (const x of [o, v, w]) {
      const mark = x.s.messages.length;
      entered.set(x, mark);
      x.s.send({ t: "enter", room: roomId });
      const welcome = await after(x.s, mark, "welcome", (m) => m.place.kind === "room");
      const me = welcome.players.find((p) => p.id === welcome.selfId)!;
      x.pos = { x: me.x, z: me.z };
    }
    // Entering a room puts nobody in a call.
    await settle();
    for (const x of [o, v, w]) expect(x.s.messages.slice(entered.get(x)).some((m) => m.t === "call" && m.call !== null)).toBe(false);

    // Full at three: a fourth guest is turned away.
    const late = await connect(await guest("Late Lou"));
    late.s.send({ t: "enter", room: roomId });
    expect(await late.s.next("enter_failed")).toEqual({ t: "enter_failed", code: "full", message: "This room is full (3 guests)." });

    // Olga and Vic sit at the long table (chairs 0 and 2 face south, toward the door): that is the call.
    const table = roomTable(3);
    expect(table.seats).toHaveLength(3);
    for (const [x, seat] of [
      [o, 0],
      [v, 2],
    ] as const) {
      x.pos = await walk(x.s, x.pos, standSpot(table, table.seats[seat]!));
      const mark = x.s.messages.length;
      x.s.send({ t: "sit", table: "long", seat });
      await after(x.s, mark, "seat", (m) => m.id === x.id && m.seat === seat);
    }
    const call = await o.s.next("call", (m) => m.call?.members.length === 2);
    expect(call.call).toMatchObject({ kind: "room", table: "long" });
    expect(call.call?.members.map((m) => m.id).sort()).toEqual([o.id, v.id].sort());

    // Signals flow between seated guests only; Wes, standing in the same room, gets none and cannot send any.
    const lobby = await connect(await guest("Larry"));
    const wesMark = w.s.messages.length;
    o.s.send({ t: "signal", to: lobby.id, data: OFFER });
    o.s.send({ t: "signal", to: w.id, data: OFFER });
    o.s.send({ t: "signal", to: v.id, data: OFFER });
    expect(await v.s.next("signal")).toMatchObject({ from: o.id });
    const olgaMark = o.s.messages.length;
    w.s.send({ t: "signal", to: o.id, data: OFFER });
    await settle();
    expect(w.s.messages.slice(wesMark).some((m) => m.t === "signal" || (m.t === "call" && m.call !== null))).toBe(false);
    expect(o.s.messages.slice(olgaMark).some((m) => m.t === "signal")).toBe(false);
    expect(lobby.s.messages.some((m) => m.t === "signal" || m.t === "call")).toBe(false);

    // Standing up leaves the call.
    const standMark = v.s.messages.length;
    v.s.send({ t: "stand" });
    expect(await after(v.s, standMark, "call")).toEqual({ t: "call", call: null });
    expect((await o.s.next("call", (m) => m.call?.members.length === 1)).call?.members.map((m) => m.id)).toEqual([o.id]);

    // Leaving the room ends the call too.
    const exitMark = o.s.messages.length;
    o.s.send({ t: "exit" });
    expect(await after(o.s, exitMark, "call")).toEqual({ t: "call", call: null });
  });

  it("rejects oversized SDP as an invalid message", async () => {
    const a = await connect(await guest("Olga"));
    await sitAt(a, lobbyTable, 0);
    await a.s.next("call", (m) => m.call !== null);
    for (let i = 0; i < 20; i++) a.s.send({ t: "signal", to: "x", data: { kind: "offer", sdp: "x".repeat(SDP_MAX + 1) } });
    expect((await a.s.closed).code).toBe(4001);
  });

  it("serves ICE servers to checked-in guests only", async () => {
    expect((await api(server, "GET", "/api/voice")).res.status).toBe(401);
    const res = await api(server, "GET", "/api/voice", await guest("Olga"));
    expect(res.json).toEqual({ iceServers: [] });
  });
});
