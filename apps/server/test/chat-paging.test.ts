import { CHAT_PAGE, DEFAULT_LOOK, type ChatMessage, type ServerMessage } from "@ghostel/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { openSocket, putMe, sessionCookie, startServer, type TestServer, type TestSocket } from "./helpers";

// M23: the chat panel shows 15 messages, older pages load on scroll, and every channel is emptied at 00:00 WIB.

let server: TestServer;
let now = Date.UTC(2026, 10, 16, 10, 0); // 17:00 WIB
const sockets: TestSocket[] = [];

beforeAll(async () => {
  server = await startServer({ hub: { chatBurst: 1000, chatRefillSeconds: 1, clock: () => now, chatDayCheckMs: 50 } });
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

async function connect(name: string) {
  const cookie = sessionCookie((await putMe(server, { name, look: DEFAULT_LOOK })).res) as string;
  const s = await openSocket(server, cookie);
  sockets.push(s);
  const welcome = await s.next("welcome");
  return { s, welcome };
}

function after<T extends ServerMessage["t"]>(s: TestSocket, from: number, type: T) {
  const started = Date.now();
  return new Promise<Extract<ServerMessage, { t: T }>>((resolve, reject) => {
    const poll = () => {
      const hit = s.messages.slice(from).find((m) => m.t === type);
      if (hit) return resolve(hit as Extract<ServerMessage, { t: T }>);
      if (Date.now() - started > 3000) return reject(new Error(`Timed out waiting for ${type}`));
      setTimeout(poll, 20);
    };
    poll();
  });
}

async function say(s: TestSocket, texts: string[]): Promise<ChatMessage[]> {
  const out: ChatMessage[] = [];
  for (const text of texts) {
    const mark = s.messages.length;
    s.send({ t: "chat", text });
    out.push((await after(s, mark, "chat")).msg);
  }
  return out;
}

async function page(s: TestSocket, before: string) {
  const mark = s.messages.length;
  s.send({ t: "chat_older", before });
  return after(s, mark, "chat_page");
}

const texts = (msgs: readonly ChatMessage[]) => msgs.map((m) => m.text);
const numbered = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `boo ${from + i}`);

describe("chat paging and the daily reset (M23)", () => {
  it("sends only the newest 15 on entry and pages back to the first message", async () => {
    // Fresh day for this test: jump a day so the lobby history starts empty.
    now += 86_400_000;
    const a = await connect("Alice");
    await new Promise((r) => setTimeout(r, 120));
    await say(a.s, numbered(1, 40));

    const late = await connect("Late Larry");
    expect(late.welcome.chat).toHaveLength(CHAT_PAGE);
    expect(texts(late.welcome.chat)).toEqual(numbered(26, 40));
    expect(late.welcome.chatMore).toBe(true);

    const p1 = await page(late.s, late.welcome.chat[0]!.id);
    expect(texts(p1.msgs)).toEqual(numbered(11, 25));
    expect(p1.more).toBe(true);
    const p2 = await page(late.s, p1.msgs[0]!.id);
    expect(texts(p2.msgs)).toEqual(numbered(1, 10));
    expect(p2.more).toBe(false);

    // Unknown ids give an empty page, not an error or someone else's chat.
    const none = await page(late.s, "zzzz");
    expect(none).toMatchObject({ msgs: [], more: false });
  });

  it("answers pages only from the requester's own channel", async () => {
    now += 86_400_000;
    const a = await connect("Alice");
    await new Promise((r) => setTimeout(r, 120));
    const lobbyMsgs = await say(a.s, numbered(1, 20));
    const b = await connect("Bob Upstairs");
    const mark = b.s.messages.length;
    b.s.send({ t: "floor", floor: 2 });
    await after(b.s, mark, "welcome");
    const leak = await page(b.s, lobbyMsgs.at(-1)!.id);
    expect(leak).toMatchObject({ msgs: [], more: false });
    expect(JSON.stringify(b.s.messages.slice(mark))).not.toContain("boo 1");
  });

  it("empties every channel at 00:00 WIB and tells connected guests", async () => {
    // 23:59 WIB on some day, then past midnight.
    const base = Math.floor((now + 7 * 3_600_000) / 86_400_000) + 2;
    now = base * 86_400_000 - 7 * 3_600_000 - 60_000;
    await new Promise((r) => setTimeout(r, 120));
    const a = await connect("Night Owl");
    await say(a.s, ["late night boo", "still up"]);
    const b = await connect("Second Owl");
    expect(texts(b.welcome.chat)).toEqual(["late night boo", "still up"]);

    const mark = a.s.messages.length;
    now += 120_000; // 00:01 WIB
    await after(a.s, mark, "chat_reset");
    await b.s.next("chat_reset");

    const c = await connect("Morning Mo");
    expect(c.welcome.chat).toEqual([]);
    expect(c.welcome.chatMore).toBe(false);
    const fresh = await say(a.s, ["good morning"]);
    const d = await connect("Dawn");
    expect(texts(d.welcome.chat)).toEqual(texts(fresh));
  });
});
