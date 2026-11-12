import { DEFAULT_LOOK, SLIDES_MAX_BYTES, roomTable, standSpot, type ServerMessage } from "@ghostel/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ORIGIN, api, openSocket, putMe, sessionCookie, startServer, type TestServer, type TestSocket } from "./helpers";

let server: TestServer;
const sockets: TestSocket[] = [];

beforeAll(async () => {
  server = await startServer({ hub: { maxConnectionsPerGuest: 10 }, roomWritesPerMinute: 10_000, slideUploadsPerMinute: 100 });
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

const settle = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(2000, 32), Buffer.from("\n%%EOF\n")]);

async function guest(name: string): Promise<string> {
  return sessionCookie((await putMe(server, { name, look: DEFAULT_LOOK })).res) as string;
}

async function connect(cookie: string) {
  const s = await openSocket(server, cookie);
  sockets.push(s);
  const welcome = await s.next("welcome");
  return { s, id: welcome.selfId };
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

type Guest = { s: TestSocket; id: string; pos: { x: number; z: number } };
/** South-facing chairs of an 8-seat long table (0, 2, 4, 6 face the door). */
const TABLE = roomTable(8);

/** Into the room, standing where the server put us. */
async function enter(c: { s: TestSocket; id: string }, roomId: string): Promise<Guest> {
  const mark = c.s.messages.length;
  c.s.send({ t: "enter", room: roomId });
  const welcome = await after(c.s, mark, "welcome", (m) => m.place.kind === "room");
  const me = welcome.players.find((p) => p.id === welcome.selfId)!;
  return { ...c, pos: { x: me.x, z: me.z } };
}

/** Walks up to a chair of the long table and sits: that joins the room's meeting (M20). */
async function sit(c: Guest, seat: number): Promise<void> {
  c.pos = await walk(c.s, c.pos, standSpot(TABLE, TABLE.seats[seat]!));
  const mark = c.s.messages.length;
  c.s.send({ t: "sit", table: "long", seat });
  await after(c.s, mark, "call", (m) => m.call?.members.some((x) => x.id === c.id) ?? false);
}

async function stand(c: Guest): Promise<void> {
  const mark = c.s.messages.length;
  c.s.send({ t: "stand" });
  const back = await after(c.s, mark, "correct");
  c.pos = { x: back.x, z: back.z };
}

/** Owner and a guest seated at a fresh room's long table, plus a lobby guest outside. */
async function setup() {
  const ownerCookie = await guest("Olga Owner");
  const vicCookie = await guest("Vic Visitor");
  const roomId = (await api(server, "POST", "/api/rooms", ownerCookie, { name: "Slide Show", access: "open", decor: "library", game: "none" })).json?.["room"].id as string;
  const owner = await enter(await connect(ownerCookie), roomId);
  const vic = await enter(await connect(vicCookie), roomId);
  const lobby = await connect(await guest("Larry Lobby"));
  await sit(owner, 0);
  await sit(vic, 2);
  return { roomId, owner, vic, lobby, ownerCookie, vicCookie };
}

async function upload(roomId: string, cookie: string, body: Buffer, type = "application/pdf") {
  const res = await fetch(`${server.base}/api/rooms/${roomId}/slides`, { method: "POST", headers: { cookie, origin: ORIGIN, "content-type": type }, body });
  return { status: res.status, json: res.status === 204 ? null : ((await res.json().catch(() => null)) as Record<string, unknown> | null) };
}

describe("presentations", () => {
  it("guests ask, only the owner decides, one presenter at a time", async () => {
    const { owner, vic, lobby } = await setup();
    let mark = owner.s.messages.length;
    vic.s.send({ t: "present_request", mode: "screen" });
    expect(await after(owner.s, mark, "present_requests", (m) => m.requests.length === 1)).toEqual({
      t: "present_requests",
      requests: [{ id: vic.id, name: "Vic Visitor", mode: "screen" }],
    });
    expect(await vic.s.next("notice")).toMatchObject({ message: "Asked the room's owner to let you present. Wait for a yes!" });

    // A guest cannot approve anyone (counts as invalid) and nothing starts.
    vic.s.send({ t: "present_decide", id: vic.id, allow: true });
    await settle();
    expect(vic.s.messages.some((m) => m.t === "presentation" && m.p !== null)).toBe(false);

    mark = vic.s.messages.length;
    owner.s.send({ t: "present_decide", id: vic.id, allow: true });
    expect(await after(vic.s, mark, "presentation", (m) => m.p !== null)).toEqual({
      t: "presentation",
      p: { presenter: vic.id, name: "Vic Visitor", mode: "screen", page: 1, pages: null, file: null },
    });
    expect(await after(owner.s, mark, "present_requests", (m) => m.requests.length === 0)).toMatchObject({ requests: [] });

    // The owner wants to present too: busy.
    mark = owner.s.messages.length;
    owner.s.send({ t: "present_request", mode: "pdf" });
    expect(await after(owner.s, mark, "notice")).toMatchObject({ message: "Vic Visitor is presenting right now." });

    // The owner can stop anyone's presentation.
    mark = vic.s.messages.length;
    owner.s.send({ t: "present_stop" });
    expect(await after(vic.s, mark, "presentation")).toEqual({ t: "presentation", p: null });

    // The owner presents without asking.
    mark = vic.s.messages.length;
    owner.s.send({ t: "present_request", mode: "pdf" });
    expect(await after(vic.s, mark, "presentation", (m) => m.p !== null)).toMatchObject({ p: { presenter: owner.id, mode: "pdf" } });

    await settle();
    expect(lobby.s.messages.some((m) => m.t === "presentation" || m.t === "present_requests")).toBe(false);
  });

  it("a refused guest hears 'not now'; only the approved presenter may share a screen", async () => {
    const { owner, vic } = await setup();
    vic.s.send({ t: "present_request", mode: "screen" });
    await owner.s.next("present_requests", (m) => m.requests.length === 1);
    let mark = vic.s.messages.length;
    owner.s.send({ t: "present_decide", id: vic.id, allow: false });
    expect(await after(vic.s, mark, "notice")).toMatchObject({ message: "The owner said not now." });

    // Without approval the screen stream id is dropped.
    mark = owner.s.messages.length;
    vic.s.send({ t: "media", mic: false, cam: null, screen: "screen-1" });
    await settle();
    expect(owner.s.messages.slice(mark).some((m) => m.t === "call" && m.call?.members.some((x) => x.screen !== null))).toBe(false);

    vic.s.send({ t: "present_request", mode: "screen" });
    await owner.s.next("present_requests", (m) => m.requests.length === 1);
    owner.s.send({ t: "present_decide", id: vic.id, allow: true });
    await vic.s.next("presentation", (m) => m.p !== null);
    mark = owner.s.messages.length;
    vic.s.send({ t: "media", mic: false, cam: null, screen: "screen-2" });
    expect(await after(owner.s, mark, "call", (m) => m.call?.members.some((x) => x.screen === "screen-2") ?? false)).toBeTruthy();

    // Stopping the presentation withdraws the screen share for everyone.
    mark = owner.s.messages.length;
    vic.s.send({ t: "present_stop" });
    await after(owner.s, mark, "presentation", (m) => m.p === null);
    expect(await after(owner.s, mark, "call", (m) => m.call?.members.every((x) => x.screen === null) ?? false)).toBeTruthy();
  });

  it("PDF slides: only the approved presenter uploads; only guests inside download; gone when it ends", async () => {
    const { roomId, owner, vic, ownerCookie, vicCookie } = await setup();
    expect((await upload(roomId, ownerCookie, PDF)).status).toBe(403); // nobody is presenting yet

    owner.s.send({ t: "present_request", mode: "pdf" });
    await vic.s.next("presentation", (m) => m.p !== null);
    expect((await upload(roomId, vicCookie, PDF)).status).toBe(403); // not the presenter
    expect(await upload(roomId, ownerCookie, Buffer.from("<html><script>alert(1)</script>"))).toMatchObject({ status: 415, json: { error: "not_pdf" } });
    // Too big: refused with 413 (the server may also cut the connection while the body is still being sent).
    const tooBig = await upload(roomId, ownerCookie, Buffer.alloc(SLIDES_MAX_BYTES + 10, 37)).then(
      (r) => r.status,
      () => "connection closed",
    );
    expect([413, "connection closed"]).toContain(tooBig);

    let mark = vic.s.messages.length;
    expect((await upload(roomId, ownerCookie, PDF, "application/octet-stream")).status).toBe(204);
    const shown = await after(vic.s, mark, "presentation", (m) => m.p?.file !== null && m.p?.file !== undefined);
    const token = shown.p?.file as string;
    expect(token).toMatch(/^[A-Za-z0-9_-]{20,}$/);

    const res = await fetch(`${server.base}/api/rooms/${roomId}/slides/${token}`, { headers: { cookie: vicCookie } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(Buffer.from(await res.arrayBuffer()).equals(PDF)).toBe(true);

    // Guests outside the room cannot fetch it, even with the token.
    const outsider = await guest("Otto Outsider");
    expect((await fetch(`${server.base}/api/rooms/${roomId}/slides/${token}`, { headers: { cookie: outsider } })).status).toBe(404);
    expect((await fetch(`${server.base}/api/rooms/${roomId}/slides/${token}`)).status).toBe(401);

    // Page turns reach the room.
    mark = vic.s.messages.length;
    owner.s.send({ t: "present_page", page: 3, pages: 12 });
    expect(await after(vic.s, mark, "presentation", (m) => m.p?.page === 3)).toMatchObject({ p: { page: 3, pages: 12 } });
    vic.s.send({ t: "present_page", page: 5, pages: 12 }); // not the presenter: ignored
    await settle();
    expect(vic.s.messages.slice(mark).some((m) => m.t === "presentation" && m.p?.page === 5)).toBe(false);

    // The presenter leaves: the presentation ends and the file is gone.
    mark = vic.s.messages.length;
    owner.s.send({ t: "exit" });
    expect(await after(vic.s, mark, "presentation")).toEqual({ t: "presentation", p: null });
    expect((await fetch(`${server.base}/api/rooms/${roomId}/slides/${token}`, { headers: { cookie: vicCookie } })).status).toBe(404);
  });

  it("standing guests are out of the meeting: they cannot ask, decide or download, and standing up ends your presentation (M20)", async () => {
    const { roomId, owner, vic, ownerCookie, vicCookie } = await setup();
    const samCookie = await guest("Sam Standing");
    const sam = await enter(await connect(samCookie), roomId);

    // A standing guest asks: told to sit first, and the owner hears nothing.
    let mark = owner.s.messages.length;
    sam.s.send({ t: "present_request", mode: "pdf" });
    expect(await after(sam.s, 0, "notice", (m) => m.message.includes("long table"))).toMatchObject({ message: "Sit at the long table to join the meeting first." });
    await settle();
    expect(owner.s.messages.slice(mark).some((m) => m.t === "present_requests" && m.requests.length > 0)).toBe(false);

    // The owner presents slides: seated Vic gets them, standing Sam gets nothing and cannot download.
    const samMark = sam.s.messages.length;
    owner.s.send({ t: "present_request", mode: "pdf" });
    await vic.s.next("presentation", (m) => m.p !== null);
    expect((await upload(roomId, ownerCookie, PDF)).status).toBe(204);
    const token = (await vic.s.next("presentation", (m) => (m.p?.file ?? null) !== null)).p?.file as string;
    expect((await fetch(`${server.base}/api/rooms/${roomId}/slides/${token}`, { headers: { cookie: vicCookie } })).status).toBe(200);
    expect((await fetch(`${server.base}/api/rooms/${roomId}/slides/${token}`, { headers: { cookie: samCookie } })).status).toBe(404);
    await settle();
    expect(sam.s.messages.slice(samMark).some((m) => m.t === "presentation" && m.p !== null)).toBe(false);

    // The presenter stands up: the presentation ends for the meeting, and the slides are gone.
    mark = vic.s.messages.length;
    const ownerMark = owner.s.messages.length;
    await stand(owner);
    expect(await after(vic.s, mark, "presentation")).toEqual({ t: "presentation", p: null });
    expect(await after(owner.s, ownerMark, "presentation")).toEqual({ t: "presentation", p: null });
    expect((await fetch(`${server.base}/api/rooms/${roomId}/slides/${token}`, { headers: { cookie: vicCookie } })).status).toBe(404);

    // Vic asks while the owner stands: the owner does not see it, and deciding from standing does nothing.
    mark = owner.s.messages.length;
    vic.s.send({ t: "present_request", mode: "screen" });
    await settle();
    expect(owner.s.messages.slice(mark).some((m) => m.t === "present_requests" && m.requests.length > 0)).toBe(false);
    const vicMark = vic.s.messages.length;
    owner.s.send({ t: "present_decide", id: vic.id, allow: true });
    await settle();
    expect(vic.s.messages.slice(vicMark).some((m) => m.t === "presentation" && m.p !== null)).toBe(false);

    // The owner sits again: the waiting request shows, and allowing it starts Vic's presentation.
    mark = owner.s.messages.length;
    await sit(owner, 0);
    expect(await after(owner.s, mark, "present_requests", (m) => m.requests.length === 1)).toMatchObject({ requests: [{ id: vic.id, mode: "screen" }] });
    owner.s.send({ t: "present_decide", id: vic.id, allow: true });
    await vic.s.next("presentation", (m) => m.p?.presenter === vic.id);

    // Vic stands up: his presentation ends and his own view is cleared.
    mark = owner.s.messages.length;
    const vicStand = vic.s.messages.length;
    await stand(vic);
    expect(await after(owner.s, mark, "presentation")).toEqual({ t: "presentation", p: null });
    expect(await after(vic.s, vicStand, "call")).toEqual({ t: "call", call: null });
    expect(await after(vic.s, vicStand, "presentation")).toEqual({ t: "presentation", p: null });
  });

  it("uploads need an allowed Origin", async () => {
    const { roomId, ownerCookie } = await setup();
    const res = await fetch(`${server.base}/api/rooms/${roomId}/slides`, {
      method: "POST",
      headers: { cookie: ownerCookie, origin: "https://evil.example", "content-type": "application/pdf" },
      body: PDF,
    });
    expect(res.status).toBe(403);
  });
});
