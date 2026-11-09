import { DEFAULT_LOOK, LOBBY_BOUNDS, PLAYER_RADIUS, type Look } from "@ghostel/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ORIGIN, openSocket, putMe, sessionCookie, startServer, upgradeStatus, type TestServer, type TestSocket } from "./helpers";

let server: TestServer;
const sockets: TestSocket[] = [];

beforeAll(async () => {
  server = await startServer({ hub: { snapshotHz: 30 } });
});
afterAll(async () => {
  await server.close();
});
beforeEach(async () => {
  await server.pool.query("TRUNCATE guests CASCADE");
});
afterEach(async () => {
  for (const s of sockets.splice(0)) s.ws.terminate();
  // Let close events reach the hub before the next test.
  await new Promise((r) => setTimeout(r, 50));
});

const cat: Look = { body: "midnight", accent: "slime", head: "cat", hat: "none", costume: "cape" };

async function guest(name: string, look: Look = DEFAULT_LOOK): Promise<string> {
  return sessionCookie((await putMe(server, { name, look })).res) as string;
}

async function connect(cookie: string): Promise<TestSocket> {
  const s = await openSocket(server, cookie);
  sockets.push(s);
  return s;
}

describe("websocket upgrade", () => {
  it("refuses connections without a valid session", async () => {
    expect(await upgradeStatus(server, { origin: ORIGIN })).toBe(401);
    expect(await upgradeStatus(server, { origin: ORIGIN, cookie: `ghostel_sid=${"B".repeat(43)}` })).toBe(401);
  });

  it("refuses connections from other origins", async () => {
    const cookie = await guest("Alice");
    expect(await upgradeStatus(server, { origin: "https://evil.example", cookie })).toBe(403);
    expect(await upgradeStatus(server, { cookie })).toBe(403);
  });

  it("limits tabs per guest", async () => {
    const cookie = await guest("Alice");
    for (let i = 0; i < 3; i++) await connect(cookie);
    expect(await upgradeStatus(server, { origin: ORIGIN, cookie })).toBe(429);
  });
});

describe("presence", () => {
  it("shows guests to each other and removes them on close", async () => {
    const aCookie = await guest("Alice");
    const bCookie = await guest("Bob", cat);
    const a = await connect(aCookie);
    const aWelcome = await a.next("welcome");
    expect(aWelcome.players).toHaveLength(1);

    const b = await connect(bCookie);
    const bWelcome = await b.next("welcome");
    expect(bWelcome.players.map((p) => p.name).sort()).toEqual(["Alice", "Bob"]);

    const join = await a.next("join");
    expect(join.player).toMatchObject({ id: bWelcome.selfId, name: "Bob", look: cat });

    // Public IDs are per-connection random strings, not database IDs or tokens.
    const { rows } = await server.pool.query<{ id: string }>("SELECT id FROM guests");
    for (const p of bWelcome.players) {
      expect(rows.map((r) => r.id)).not.toContain(p.id);
      expect(aCookie).not.toContain(p.id);
      expect(bCookie).not.toContain(p.id);
    }

    b.ws.close();
    const leave = await a.next("leave");
    expect(leave.id).toBe(bWelcome.selfId);
  });

  it("broadcasts accepted movement to other guests", async () => {
    const a = await connect(await guest("Alice"));
    const aWelcome = await a.next("welcome");
    const b = await connect(await guest("Bob"));
    await b.next("welcome");
    const me = aWelcome.players.find((p) => p.id === aWelcome.selfId);
    if (!me) throw new Error("self missing from welcome");

    a.send({ t: "move", x: me.x + 0.2, z: me.z, ry: 1 });
    const snap = await b.next("snap", (m) => m.p.some(([id]) => id === aWelcome.selfId));
    const row = snap.p.find(([id]) => id === aWelcome.selfId);
    expect(row?.[1]).toBeCloseTo(me.x + 0.2, 2);
    expect(row?.[3]).toBeCloseTo(1, 2);
    expect(a.messages.some((m) => m.t === "correct")).toBe(false);
  });

  it("never lets a fake position leave the building", async () => {
    const a = await connect(await guest("Alice"));
    const aWelcome = await a.next("welcome");
    const b = await connect(await guest("Bob"));
    await b.next("welcome");

    for (let i = 0; i < 40; i++) {
      a.send({ t: "move", x: i % 2 === 0 ? 9999 : -9999, z: 9999, ry: 0 });
      await new Promise((r) => setTimeout(r, 25));
    }
    const correction = await a.next("correct");
    expect(Number.isFinite(correction.x)).toBe(true);
    await new Promise((r) => setTimeout(r, 100));

    const rows = b.messages.flatMap((m) => (m.t === "snap" ? m.p : [])).filter(([id]) => id === aWelcome.selfId);
    expect(rows.length).toBeGreaterThan(0);
    for (const [, x, z] of rows) {
      expect(x).toBeGreaterThanOrEqual(LOBBY_BOUNDS.minX + PLAYER_RADIUS - 0.01);
      expect(x).toBeLessThanOrEqual(LOBBY_BOUNDS.maxX - PLAYER_RADIUS + 0.01);
      expect(z).toBeGreaterThanOrEqual(LOBBY_BOUNDS.minZ + PLAYER_RADIUS - 0.01);
      expect(z).toBeLessThanOrEqual(LOBBY_BOUNDS.maxZ - PLAYER_RADIUS + 0.01);
    }
  });

  it("limits speed: one huge jump is cut short and corrected", async () => {
    const a = await connect(await guest("Alice"));
    const welcome = await a.next("welcome");
    const me = welcome.players.find((p) => p.id === welcome.selfId);
    if (!me) throw new Error("self missing");
    a.send({ t: "move", x: me.x + 10, z: me.z, ry: 0 });
    const correction = await a.next("correct");
    expect(correction.x - me.x).toBeLessThanOrEqual(2.51);
  });

  it("pushes a profile change to other guests immediately", async () => {
    const aCookie = await guest("Alice");
    const a = await connect(aCookie);
    const aWelcome = await a.next("welcome");
    const b = await connect(await guest("Bob"));
    await b.next("welcome");

    await putMe(server, { name: "Alice the Ghoul", look: cat }, aCookie);
    const update = await b.next("profile");
    expect(update).toEqual({ t: "profile", id: aWelcome.selfId, name: "Alice the Ghoul", look: cat });
  });

  it("closes sockets that keep sending invalid messages", async () => {
    const a = await connect(await guest("Alice"));
    await a.next("welcome");
    for (let i = 0; i < 25; i++) a.send(i % 2 ? "not json" : { t: "move", x: "1e999", z: 0, ry: 0 });
    expect((await a.closed).code).toBe(4001);
  });
});
