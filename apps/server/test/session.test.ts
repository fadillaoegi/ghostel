import { createHash } from "node:crypto";
import { DEFAULT_LOOK, type Look } from "@ghostel/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getMe, putMe, sessionCookie, startServer, type TestServer } from "./helpers";

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});
afterAll(async () => {
  await server.close();
});
beforeEach(async () => {
  await server.pool.query("TRUNCATE guests CASCADE");
});

const skeleton: Look = { body: "bone", accent: "midnight", head: "skull", hat: "top", costume: "none" };

describe("guest session", () => {
  it("returns no guest without a cookie", async () => {
    const { res, json } = await getMe(server);
    expect(res.status).toBe(200);
    expect(json).toEqual({ guest: null });
  });

  it("creates a guest with an HttpOnly cookie and stores only the token hash", async () => {
    const { res, json } = await putMe(server, { name: "  Count   Dracula ", look: DEFAULT_LOOK });
    expect(res.status).toBe(200);
    expect(json).toEqual({ guest: { name: "Count Dracula", look: DEFAULT_LOOK, candies: [] } });

    const header = res.headers.getSetCookie().find((h) => h.startsWith("ghostel_sid="));
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Lax/i);
    expect(header).toMatch(/Path=\//);

    const cookie = sessionCookie(res) as string;
    const token = cookie.split("=")[1] as string;
    expect(JSON.stringify(json)).not.toContain(token);

    const { rows } = await server.pool.query<{ token_hash: Buffer }>("SELECT token_hash FROM guests");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.token_hash.equals(createHash("sha256").update(token).digest())).toBe(true);
    expect(rows[0]?.token_hash.toString("utf8")).not.toContain(token);
  });

  it("keeps name and look after a reload", async () => {
    const created = await putMe(server, { name: "Mr Bones", look: skeleton });
    const cookie = sessionCookie(created.res) as string;
    const { json } = await getMe(server, cookie);
    expect(json).toEqual({ guest: { name: "Mr Bones", look: skeleton, candies: [] } });
  });

  it("updates the same guest when the cookie is present", async () => {
    const created = await putMe(server, { name: "Mr Bones", look: skeleton });
    const cookie = sessionCookie(created.res) as string;
    const updated = await putMe(server, { name: "Sir Bones", look: DEFAULT_LOOK }, cookie);
    expect(updated.res.status).toBe(200);
    expect(sessionCookie(updated.res)).toBeNull();
    const { rows } = await server.pool.query("SELECT name FROM guests");
    expect(rows).toEqual([{ name: "Sir Bones" }]);
  });

  it("two guests cannot change each other's profile", async () => {
    const a = sessionCookie((await putMe(server, { name: "Alice", look: DEFAULT_LOOK })).res) as string;
    const b = sessionCookie((await putMe(server, { name: "Bob", look: skeleton })).res) as string;
    expect(a).not.toEqual(b);

    await putMe(server, { name: "Bob Renamed", look: DEFAULT_LOOK }, b);
    expect((await getMe(server, a)).json.guest?.name).toBe("Alice");
    expect((await getMe(server, b)).json.guest?.name).toBe("Bob Renamed");

    // A forged or unknown token never reaches an existing guest; it gets a brand-new guest instead.
    const forged = `ghostel_sid=${"A".repeat(43)}`;
    const forgedRes = await putMe(server, { name: "Mallory", look: DEFAULT_LOOK }, forged);
    expect(forgedRes.res.status).toBe(200);
    expect(sessionCookie(forgedRes.res)).not.toEqual(forged);
    expect((await getMe(server, a)).json.guest?.name).toBe("Alice");
    expect((await getMe(server, b)).json.guest?.name).toBe("Bob Renamed");
    expect((await getMe(server, forged)).json.guest).toBeNull();

    // The API has no way to address another guest by ID.
    const byId = await fetch(`${server.base}/api/guests/whatever`, { method: "PUT", headers: { origin: "http://localhost:5290" } });
    expect(byId.status).toBe(404);
  });

  it("ignores malformed cookies", async () => {
    for (const cookie of ["ghostel_sid=", "ghostel_sid=short", `ghostel_sid=${"!".repeat(43)}`, "ghostel_sid=' OR 1=1 --"]) {
      expect((await getMe(server, cookie)).json).toEqual({ guest: null });
    }
  });
});

describe("profile validation", () => {
  it("rejects an invalid name with a clear message and stores nothing", async () => {
    const { res, json } = await putMe(server, { name: "x", look: DEFAULT_LOOK });
    expect(res.status).toBe(400);
    expect(json).toEqual({ error: "invalid_profile", field: "name", message: "Name must be at least 2 characters." });
    expect(sessionCookie(res)).toBeNull();
    expect((await server.pool.query("SELECT 1 FROM guests")).rowCount).toBe(0);
  });

  it.each([
    [{ name: "a".repeat(21), look: DEFAULT_LOOK }, "Name can be at most 20 characters."],
    [{ name: "<img src=x>", look: DEFAULT_LOOK }, "Name can use letters, numbers, spaces and - _ . ' and must start with a letter or number."],
    [{ look: DEFAULT_LOOK }, "Please enter a name."],
  ])("rejects %j", async (body, message) => {
    const { res, json } = await putMe(server, body);
    expect(res.status).toBe(400);
    expect(json["message"]).toBe(message);
  });

  it("rejects unknown costume parts", async () => {
    const { res, json } = await putMe(server, { name: "Bo", look: { ...DEFAULT_LOOK, hat: "tiara" } });
    expect(res.status).toBe(400);
    expect(json).toMatchObject({ field: "look" });
  });

  it("does not let an invalid update overwrite a saved profile", async () => {
    const cookie = sessionCookie((await putMe(server, { name: "Alice", look: DEFAULT_LOOK })).res) as string;
    expect((await putMe(server, { name: "", look: DEFAULT_LOOK }, cookie)).res.status).toBe(400);
    expect((await getMe(server, cookie)).json.guest?.name).toBe("Alice");
  });
});

describe("request protection", () => {
  it("rejects writes without an allowed Origin", async () => {
    expect((await putMe(server, { name: "Bo", look: DEFAULT_LOOK }, undefined, null)).res.status).toBe(403);
    expect((await putMe(server, { name: "Bo", look: DEFAULT_LOOK }, undefined, "https://evil.example")).res.status).toBe(403);
    expect((await server.pool.query("SELECT 1 FROM guests")).rowCount).toBe(0);
  });

  it("rejects oversized bodies", async () => {
    const { res } = await putMe(server, { name: "Bo", look: DEFAULT_LOOK, pad: "x".repeat(5000) });
    expect(res.status).toBe(413);
  });

  it("rate limits profile writes per client", async () => {
    const limited = await startServer({ profileWritesPerMinute: 2 });
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 3; i++) statuses.push((await putMe(limited, { name: `Guest ${i}`, look: DEFAULT_LOOK })).res.status);
      expect(statuses).toEqual([200, 200, 429]);
    } finally {
      await limited.close();
    }
  });
});
