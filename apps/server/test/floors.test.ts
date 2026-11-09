import { CANDIES, COUNTER_SPOT, DEFAULT_LOOK, ELEVATORS, SNACK_MS, type ServerMessage } from "@ghostel/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { api, getMe, openSocket, putMe, sessionCookie, startServer, type TestServer, type TestSocket } from "./helpers";

let server: TestServer;
let skew = 0;
const sockets: TestSocket[] = [];

beforeAll(async () => {
  // `skew` lets a test jump the hub's clock forward (snack expiry).
  server = await startServer({ hub: { snapshotHz: 30, now: () => performance.now() + skew }, roomWritesPerMinute: 10_000 });
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

const settle = (ms = 300) => new Promise((r) => setTimeout(r, ms));

async function guest(name: string): Promise<string> {
  return sessionCookie((await putMe(server, { name, look: DEFAULT_LOOK })).res) as string;
}

function after<T extends ServerMessage["t"]>(s: TestSocket, from: number, type: T, where: (m: Extract<ServerMessage, { t: T }>) => boolean = () => true) {
  const started = Date.now();
  return new Promise<Extract<ServerMessage, { t: T }>>((resolve, reject) => {
    const poll = () => {
      const hit = s.messages.slice(from).find((m) => m.t === type && where(m as Extract<ServerMessage, { t: T }>));
      if (hit) return resolve(hit as Extract<ServerMessage, { t: T }>);
      if (Date.now() - started > 5000) return reject(new Error(`timed out waiting for ${type}`));
      setTimeout(poll, 10);
    };
    poll();
  });
}

async function connect(cookie: string) {
  const s = await openSocket(server, cookie);
  sockets.push(s);
  const welcome = await s.next("welcome");
  const me = welcome.players.find((p) => p.id === welcome.selfId);
  return { s, id: welcome.selfId, pos: { x: me?.x ?? 0, z: me?.z ?? 0 }, welcome };
}

async function ride(s: TestSocket, floor: number) {
  const from = s.messages.length;
  s.send({ t: "floor", floor });
  return after(s, from, "welcome");
}

/** Walks in small steps that stay inside the server's speed budget. */
async function walk(s: TestSocket, from: { x: number; z: number }, to: { x: number; z: number }) {
  const step = 0.18;
  let { x, z } = from;
  while (Math.hypot(to.x - x, to.z - z) > 0.05) {
    const d = Math.hypot(to.x - x, to.z - z);
    const k = Math.min(1, step / d);
    x += (to.x - x) * k;
    z += (to.z - z) * k;
    s.send({ t: "move", x, z, ry: 0 });
    await new Promise((r) => setTimeout(r, 40));
  }
  await settle(120);
}

describe("floors and the elevator", () => {
  it("rides between floors, steps out at the elevator, and keeps floors separate", async () => {
    const a = await connect(await guest("Alice"));
    const lobby = await connect(await guest("Larry Lobby"));

    const up = await ride(a.s, 2);
    expect(up.place).toEqual({ kind: "floor", floor: 2 });
    const me = up.players.find((p) => p.id === up.selfId);
    // Steps out in front of the floor 2 elevator (small random spread).
    expect(Math.abs((me?.x ?? 0) - ELEVATORS[2].door.x)).toBeLessThanOrEqual(0.51);
    expect(me?.z).toBeCloseTo(ELEVATORS[2].arrive(() => 0.5).z, 1);
    expect((await lobby.s.next("leave", (m) => m.id === a.id)).id).toBe(a.id);

    const mark = lobby.s.messages.length;
    a.s.send({ t: "chat", text: "hello from the gallery" });
    await a.s.next("chat");
    await settle();
    expect(JSON.stringify(lobby.s.messages.slice(mark))).not.toContain("gallery");

    const four = await ride(a.s, 4);
    expect(four.place).toEqual({ kind: "floor", floor: 4 });
    const five = await ride(a.s, 5);
    expect(five.place).toEqual({ kind: "floor", floor: 5 });
    const down = await ride(a.s, 1);
    expect(down.place).toEqual({ kind: "lobby" });
    const lobbyMe = down.players.find((p) => p.id === down.selfId);
    expect(lobbyMe?.z).toBeCloseTo(-8.6, 1); // in front of the lobby elevator, not at the front door
  });

  it("the elevator does not run from inside a room, and bad floors are invalid", async () => {
    const cookie = await guest("Olga");
    const roomId = (await api(server, "POST", "/api/rooms", cookie, { name: "Den", access: "open", decor: "crypt", game: "none" })).json?.["room"].id;
    const a = await connect(cookie);
    const mark = a.s.messages.length;
    a.s.send({ t: "enter", room: roomId });
    await after(a.s, mark, "welcome", (m) => m.place.kind === "room");
    const mark2 = a.s.messages.length;
    a.s.send({ t: "floor", floor: 3 });
    await settle();
    expect(a.s.messages.slice(mark2).some((m) => m.t === "welcome")).toBe(false);
    for (let i = 0; i < 20; i++) a.s.send({ t: "floor", floor: 9 });
    expect((await a.s.closed).code).toBe(4001);
  });
});

describe("candy hunt", () => {
  const welcomeCandy = CANDIES.find((c) => c.id === "lobby-welcome")!;

  it("collects a candy when standing next to it, syncs tabs, tells the floor and persists", async () => {
    const cookie = await guest("Candy Carla");
    const a = await connect(cookie);
    const tab2 = await connect(cookie);
    const watcher = await connect(await guest("Wally Watcher"));
    expect(a.welcome.candies).toEqual([]);

    await walk(a.s, a.pos, { x: welcomeCandy.x - 0.5, z: welcomeCandy.z });
    a.s.send({ t: "collect", candy: welcomeCandy.id });
    expect((await a.s.next("candies")).found).toEqual(["lobby-welcome"]);
    expect((await tab2.s.next("candies")).found).toEqual(["lobby-welcome"]);
    expect(await watcher.s.next("candy_found")).toEqual({ t: "candy_found", id: a.id, name: "Candy Carla" });
    expect((await getMe(server, cookie)).json.guest).toMatchObject({ candies: ["lobby-welcome"] });

    // Collecting again changes nothing.
    const mark = a.s.messages.length;
    a.s.send({ t: "collect", candy: welcomeCandy.id });
    await settle();
    expect(a.s.messages.slice(mark).some((m) => m.t === "candies")).toBe(false);
  });

  it("refuses candies that are far away or on another floor", async () => {
    const a = await connect(await guest("Far Fred"));
    a.s.send({ t: "collect", candy: "lobby-corner" }); // across the hall
    a.s.send({ t: "collect", candy: "gallery-runway" }); // another floor
    await settle();
    expect(a.s.messages.some((m) => m.t === "candies")).toBe(false);

    const up = await ride(a.s, 2);
    const me = up.players.find((p) => p.id === up.selfId)!;
    const runway = CANDIES.find((c) => c.id === "gallery-runway")!;
    await walk(a.s, me, { x: runway.x - 0.5, z: runway.z });
    a.s.send({ t: "collect", candy: "lobby-welcome" }); // standing on floor 2
    await settle();
    expect(a.s.messages.some((m) => m.t === "candies")).toBe(false);
    a.s.send({ t: "collect", candy: "gallery-runway" });
    expect((await a.s.next("candies")).found).toEqual(["gallery-runway"]);
  });

  it("the Golden Crown is locked until every candy is found", async () => {
    const cookie = await guest("Crowny");
    const crown = { ...DEFAULT_LOOK, hat: "crown" };
    const locked = await putMe(server, { name: "Crowny", look: crown }, cookie);
    expect(locked.res.status).toBe(400);
    expect(locked.json["message"]).toBe("The Golden Crown unlocks after you find all 12 candies in the hotel.");
    // A brand-new visitor cannot start with it either.
    expect((await putMe(server, { name: "Newbie", look: crown })).res.status).toBe(400);

    // Eleven found already; the last one unlocks it and says so.
    const rest = CANDIES.filter((c) => c.id !== welcomeCandy.id).map((c) => c.id);
    await server.pool.query("UPDATE guests SET candies = $1 WHERE name = 'Crowny'", [rest]);
    const a = await connect(cookie);
    expect(a.welcome.candies).toHaveLength(11);
    await walk(a.s, a.pos, { x: welcomeCandy.x - 0.5, z: welcomeCandy.z });
    a.s.send({ t: "collect", candy: welcomeCandy.id });
    expect((await a.s.next("candies")).found).toHaveLength(12);
    expect((await a.s.next("notice")).message).toContain("Golden Crown");
    expect((await putMe(server, { name: "Crowny", look: crown }, cookie)).res.status).toBe(200);
  });

  it("unknown candy ids count as invalid messages", async () => {
    const a = await connect(await guest("Hacker Hal"));
    for (let i = 0; i < 20; i++) a.s.send({ t: "collect", candy: "free-candy" });
    expect((await a.s.closed).code).toBe(4001);
  });
});

describe("Ghoul's Diner", () => {
  /** From the floor 4 elevator, around the end of the counter, to the order spot. */
  async function toCounter(s: TestSocket, from: { x: number; z: number }) {
    await walk(s, from, { x: -6, z: -7 });
    await walk(s, { x: -6, z: -7 }, COUNTER_SPOT);
  }

  it("serves a snack at the counter; everyone on the floor sees it, other floors do not", async () => {
    const a = await connect(await guest("Hungry Hank"));
    const diner = await connect(await guest("Diner Dot"));
    const lobby = await connect(await guest("Lobby Lou"));
    const arrived = await ride(a.s, 4);
    await ride(diner.s, 4);
    const me = arrived.players.find((p) => p.id === arrived.selfId)!;
    await toCounter(a.s, me);
    const lobbyMark = lobby.s.messages.length;

    a.s.send({ t: "order", snack: "worm_noodles" });
    expect(await diner.s.next("snack")).toEqual({ t: "snack", id: a.id, name: "Hungry Hank", snack: "worm_noodles" });
    expect(await a.s.next("snack")).toMatchObject({ id: a.id, snack: "worm_noodles" });

    // A newcomer sees the snack in the welcome; it travels with the guest to another floor.
    const late = await connect(await guest("Late Lily"));
    const lateDiner = await ride(late.s, 4);
    expect(lateDiner.players.find((p) => p.id === a.id)?.snack).toBe("worm_noodles");
    const down = await ride(a.s, 1);
    expect(down.players.find((p) => p.id === down.selfId)?.snack).toBe("worm_noodles");
    await settle();
    expect(lobby.s.messages.slice(lobbyMark).some((m) => m.t === "snack")).toBe(false);
  });

  it("refuses orders far from the counter, on other floors, too fast or off the menu", async () => {
    const a = await connect(await guest("Picky Pete"));
    a.s.send({ t: "order", snack: "pumpkin_pie" }); // in the lobby
    const arrived = await ride(a.s, 4);
    a.s.send({ t: "order", snack: "pumpkin_pie" }); // at the elevator, far from the counter
    await settle();
    expect(a.s.messages.some((m) => m.t === "snack")).toBe(false);

    await toCounter(a.s, arrived.players.find((p) => p.id === arrived.selfId)!);
    a.s.send({ t: "order", snack: "pumpkin_pie" });
    await a.s.next("snack");
    const mark = a.s.messages.length;
    a.s.send({ t: "order", snack: "bat_cookie" }); // within the cooldown
    await settle();
    expect(a.s.messages.slice(mark).some((m) => m.t === "snack")).toBe(false);

    for (let i = 0; i < 20; i++) a.s.send({ t: "order", snack: "garlic_bread" });
    expect((await a.s.closed).code).toBe(4001);
  });

  it("the snack is gone after a minute", async () => {
    const a = await connect(await guest("Quick Quinn"));
    const arrived = await ride(a.s, 4);
    await toCounter(a.s, arrived.players.find((p) => p.id === arrived.selfId)!);
    a.s.send({ t: "order", snack: "brain_jelly" });
    await a.s.next("snack", (m) => m.snack === "brain_jelly");
    skew += SNACK_MS + 1000;
    expect(await a.s.next("snack", (m) => m.snack === null)).toMatchObject({ id: a.id, snack: null });
  });
});

describe("scene changes", () => {
  it("drops moves that were sent for the previous scene", async () => {
    const a = await connect(await guest("Laggy Lou"));
    expect(a.welcome.epoch).toBe(0);
    const up = await ride(a.s, 3);
    expect(up.epoch).toBe(1);
    const arrived = up.players.find((p) => p.id === up.selfId)!;
    // A move still tagged with the lobby's epoch arrives after the ride: it must not drag us anywhere.
    a.s.send({ t: "move", x: arrived.x + 2, z: arrived.z + 2, ry: 0, e: 0 });
    await settle();
    expect(a.s.messages.some((m) => m.t === "correct")).toBe(false);
    a.s.send({ t: "move", x: arrived.x + 0.2, z: arrived.z, ry: 0, e: 1 });
    await settle();
    expect(a.s.messages.some((m) => m.t === "correct")).toBe(false);
  });
});
