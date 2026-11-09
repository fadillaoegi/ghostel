import { DEFAULT_LOOK, type ChatMessage } from "@ghostel/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { openSocket, putMe, sessionCookie, startServer, type TestServer, type TestSocket } from "./helpers";

let server: TestServer;
const sockets: TestSocket[] = [];

beforeAll(async () => {
  // Small, slow-refilling bucket so the rate limit is deterministic in tests.
  server = await startServer({ hub: { chatBurst: 3, chatRefillSeconds: 60 } });
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

async function guest(name: string): Promise<string> {
  return sessionCookie((await putMe(server, { name, look: DEFAULT_LOOK })).res) as string;
}

async function connect(cookie: string): Promise<{ s: TestSocket; selfId: string; history: ChatMessage[] }> {
  const s = await openSocket(server, cookie);
  sockets.push(s);
  const welcome = await s.next("welcome");
  return { s, selfId: welcome.selfId, history: welcome.chat };
}

const chats = (s: TestSocket) => s.messages.flatMap((m) => (m.t === "chat" ? [m.msg] : []));
const settle = () => new Promise((r) => setTimeout(r, 300));

describe("lobby chat", () => {
  it("broadcasts normalised text with a server-chosen sender", async () => {
    const a = await connect(await guest("Alice"));
    const b = await connect(await guest("Bob"));

    a.s.send({ t: "chat", text: "  Boo!\n\n Happy   Kiroween  " });
    const received = await b.s.next("chat");
    expect(received.msg).toMatchObject({ from: a.selfId, name: "Alice", text: "Boo! Happy Kiroween" });
    expect(typeof received.msg.at).toBe("number");
    // The sender gets the same message back as a delivery receipt.
    expect((await a.s.next("chat")).msg).toEqual(received.msg);
  });

  it("drops messages that try to pick their own sender", async () => {
    const a = await connect(await guest("Alice"));
    const b = await connect(await guest("Bob"));
    a.s.send({ t: "chat", text: "I am Bob", from: b.selfId, name: "Bob" });
    await settle();
    expect(chats(b.s)).toEqual([]);
    expect(chats(a.s)).toEqual([]);
  });

  it("rejects empty and too-long messages with a reason and never broadcasts them", async () => {
    const a = await connect(await guest("Alice"));
    const b = await connect(await guest("Bob"));

    a.s.send({ t: "chat", text: "   \n " });
    expect(await a.s.next("error")).toEqual({ t: "error", code: "chat_invalid", message: "Type a message first." });

    a.s.send({ t: "chat", text: "x".repeat(201) });
    expect(await a.s.next("error", (m) => m.message.includes("200"))).toEqual({
      t: "error",
      code: "chat_invalid",
      message: "Messages can be at most 200 characters.",
    });
    await settle();
    expect(chats(b.s)).toEqual([]);
  });

  it("rate limits per guest, even across several tabs", async () => {
    const aliceCookie = await guest("Alice");
    const tab1 = await connect(aliceCookie);
    const tab2 = await connect(aliceCookie);
    const b = await connect(await guest("Bob"));

    for (let i = 1; i <= 3; i++) tab1.s.send({ t: "chat", text: `spam ${i}` });
    await settle();
    tab2.s.send({ t: "chat", text: "spam from another tab" });
    expect(await tab2.s.next("error")).toMatchObject({ code: "chat_rate_limited" });
    await settle();
    expect(chats(b.s).map((m) => m.text)).toEqual(["spam 1", "spam 2", "spam 3"]);

    // Another guest has their own bucket.
    b.s.send({ t: "chat", text: "I can still talk" });
    expect((await tab1.s.next("chat", (m) => m.msg.from === b.selfId)).msg.text).toBe("I can still talk");
  });

  it("sends recent history to guests who join later", async () => {
    const a = await connect(await guest("Alice"));
    a.s.send({ t: "chat", text: "anyone here?" });
    await a.s.next("chat");
    const late = await connect(await guest("Latecomer"));
    expect(late.history.at(-1)).toMatchObject({ from: a.selfId, name: "Alice", text: "anyone here?" });
  });

  it("uses the new name for new messages only", async () => {
    const aliceCookie = await guest("Alice");
    const a = await connect(aliceCookie);
    const b = await connect(await guest("Bob"));

    a.s.send({ t: "chat", text: "before" });
    await b.s.next("chat", (m) => m.msg.text === "before");
    await putMe(server, { name: "Alice Renamed", look: DEFAULT_LOOK }, aliceCookie);
    await b.s.next("profile");
    a.s.send({ t: "chat", text: "after" });
    await b.s.next("chat", (m) => m.msg.text === "after");

    expect(chats(b.s).map((m) => [m.name, m.text])).toEqual([
      ["Alice", "before"],
      ["Alice Renamed", "after"],
    ]);
  });
});
