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
