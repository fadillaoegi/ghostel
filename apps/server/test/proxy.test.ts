import { DEFAULT_LOOK } from "@ghostel/shared";
import { describe, expect, it } from "vitest";
import { ORIGIN, startServer, type TestServer } from "./helpers";

async function putFrom(server: TestServer, forwardedFor: string) {
  const res = await fetch(`${server.base}/api/me`, {
    method: "PUT",
    headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": forwardedFor },
    body: JSON.stringify({ name: "Proxy Pat", look: DEFAULT_LOOK }),
  });
  return res.status;
}

describe("client IP behind a proxy (rate limiting)", () => {
  it("without TRUST_PROXY, a forged X-Forwarded-For cannot dodge the rate limit", async () => {
    const server = await startServer({ profileWritesPerMinute: 1 }, { trustProxy: 0 });
    try {
      expect(await putFrom(server, "203.0.113.1")).toBe(200);
      expect(await putFrom(server, "203.0.113.2")).toBe(429);
    } finally {
      await server.close();
    }
  });

  it("with one trusted hop, the proxy's view of the client IP is used", async () => {
    const server = await startServer({ profileWritesPerMinute: 1 }, { trustProxy: 1 });
    try {
      expect(await putFrom(server, "203.0.113.1")).toBe(200);
      expect(await putFrom(server, "203.0.113.2")).toBe(200);
      // A client prepending fake entries only changes the untrusted left side: still limited as 203.0.113.2.
      expect(await putFrom(server, "198.51.100.9, 203.0.113.2")).toBe(429);
    } finally {
      await server.close();
    }
  });
});
