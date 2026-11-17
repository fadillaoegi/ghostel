import { createHmac } from "node:crypto";
import { DEFAULT_LOOK } from "@ghostel/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, putMe, sessionCookie, startServer, type TestServer } from "./helpers";

const SECRET = "test-secret-0123456789abcdef0123456789abcdef";
const TURN = { urls: ["turn:turn.example.com:3478?transport=udp", "turns:turn.example.com:5349"], secret: SECRET, ttlSeconds: 3600 };

let server: TestServer;

beforeAll(async () => {
  server = await startServer({}, { voiceIceServers: [{ urls: "stun:turn.example.com:3478" }], turn: TURN });
});
afterAll(async () => {
  await server.close();
});

describe("TURN credentials (M22)", () => {
  it("are given to checked-in guests only", async () => {
    const res = await api(server, "GET", "/api/voice");
    expect(res.res.status).toBe(401);
    expect(JSON.stringify(res.json)).not.toContain("turn:");
  });

  it("are short-lived, signed with the shared secret, and carry no guest id", async () => {
    await server.pool.query("TRUNCATE guests CASCADE");
    const cookie = sessionCookie((await putMe(server, { name: "Turner", look: DEFAULT_LOOK })).res) as string;
    const before = Math.floor(Date.now() / 1000);
    const { res, json } = await api(server, "GET", "/api/voice", cookie);
    const after = Math.floor(Date.now() / 1000);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = json as { iceServers: { urls: string | string[]; username?: string; credential?: string }[]; ttl: number };
    expect(body.ttl).toBe(3600);
    expect(body.iceServers[0]).toEqual({ urls: "stun:turn.example.com:3478" });
    const turn = body.iceServers[1];
    expect(turn?.urls).toEqual(TURN.urls);
    const [expiry, label] = (turn?.username ?? "").split(":");
    expect(label).toBe("ghostel");
    expect(Number(expiry)).toBeGreaterThanOrEqual(before + 3600);
    expect(Number(expiry)).toBeLessThanOrEqual(after + 3600);
    expect(turn?.credential).toBe(createHmac("sha1", SECRET).update(turn?.username ?? "").digest("base64"));
    const { rows } = await server.pool.query<{ id: string }>("SELECT id FROM guests");
    for (const row of rows) expect(JSON.stringify(body)).not.toContain(row.id);
  });
});
