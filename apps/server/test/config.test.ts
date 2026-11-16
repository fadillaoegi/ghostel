import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

const BASE = { DATABASE_URL: "postgres://u:p@127.0.0.1:5432/ghostel", ALLOWED_ORIGINS: "https://ghostel.example.com" };

describe("production configuration", () => {
  it("accepts the values from .env.production.example", () => {
    const c = loadConfig({ ...BASE, NODE_ENV: "production", HOST: "127.0.0.1", PORT: "2590", TRUST_PROXY: "1" });
    expect(c.production).toBe(true);
    expect([...c.allowedOrigins]).toEqual(["https://ghostel.example.com"]);
    expect(c.trustProxy).toBe(1);
    expect(c.host).toBe("127.0.0.1");
  });

  it("refuses http origins (except localhost for the smoke test), paths and trailing slashes", () => {
    const prod = (origins: string) => () => loadConfig({ ...BASE, NODE_ENV: "production", ALLOWED_ORIGINS: origins });
    expect(prod("http://ghostel.example.com")).toThrow("must use https://");
    expect(prod("https://ghostel.example.com/")).toThrow("without a path or trailing slash");
    expect(prod("ghostel.example.com")).toThrow("invalid entry");
    expect(prod("http://localhost:2597")).not.toThrow();
    expect(prod("https://a.example.com,https://www.a.example.com")).not.toThrow();
  });

  it("refuses TRIVIA_FAST in production, allows it in development", () => {
    expect(() => loadConfig({ ...BASE, NODE_ENV: "production", TRIVIA_FAST: "1" })).toThrow("automated tests only");
    expect(() => loadConfig({ ...BASE, NODE_ENV: "development", TRIVIA_FAST: "1", ALLOWED_ORIGINS: "http://localhost:5290" })).not.toThrow();
  });

  it("still requires DATABASE_URL and ALLOWED_ORIGINS", () => {
    expect(() => loadConfig({ NODE_ENV: "production", ALLOWED_ORIGINS: "https://x.example.com" })).toThrow("DATABASE_URL");
    expect(() => loadConfig({ NODE_ENV: "production", DATABASE_URL: "postgres://x" })).toThrow("ALLOWED_ORIGINS");
  });
});

describe("TURN configuration (M22)", () => {
  const LONG = "a".repeat(64);
  const prod = (extra: Record<string, string>) => () => loadConfig({ ...BASE, NODE_ENV: "production", ...extra });

  it("is off when neither TURN_URLS nor TURN_SECRET is set", () => {
    expect(loadConfig({ ...BASE, NODE_ENV: "production" }).turn).toBeNull();
  });

  it("parses URLs and the TTL (default 6 hours)", () => {
    const c = loadConfig({ ...BASE, NODE_ENV: "production", TURN_URLS: "turn:t.example.com:3478?transport=udp, turns:t.example.com:5349", TURN_SECRET: LONG });
    expect(c.turn).toEqual({ urls: ["turn:t.example.com:3478?transport=udp", "turns:t.example.com:5349"], secret: LONG, ttlSeconds: 21_600 });
    expect(loadConfig({ ...BASE, TURN_URLS: "turn:t:3478", TURN_SECRET: "x", TURN_TTL_SECONDS: "900" }).turn?.ttlSeconds).toBe(900);
  });

  it("refuses half a configuration, non-TURN URLs, short secrets in production and odd TTLs", () => {
    expect(prod({ TURN_URLS: "turn:t:3478" })).toThrow("set together");
    expect(prod({ TURN_SECRET: LONG })).toThrow("set together");
    expect(prod({ TURN_URLS: "stun:t:3478", TURN_SECRET: LONG })).toThrow("turn: or turns:");
    expect(prod({ TURN_URLS: "https://t", TURN_SECRET: LONG })).toThrow("turn: or turns:");
    expect(prod({ TURN_URLS: "turn:t:3478", TURN_SECRET: "short" })).toThrow("at least 32");
    expect(prod({ TURN_URLS: "turn:t:3478", TURN_SECRET: LONG, TURN_TTL_SECONDS: "60" })).toThrow("600 to 86400");
    expect(prod({ TURN_URLS: "turn:t:3478", TURN_SECRET: LONG, TURN_TTL_SECONDS: "1.5" })).toThrow("600 to 86400");
  });
});
