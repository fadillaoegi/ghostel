import type { AddressInfo } from "node:net";
import { TRIVIA_DEFAULTS, type ServerMessage } from "@ghostel/shared";
import WebSocket from "ws";
import { buildApp, type AppOverrides, type GhostelApp } from "../src/app";
import type { Config } from "../src/config";

export const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? "postgres://ghostel:ghostel_local_only@127.0.0.1:5490/ghostel_test";
export const ORIGIN = "http://localhost:5290";

export interface TestServer extends GhostelApp {
  base: string;
  wsUrl: string;
}

export async function startServer(overrides: AppOverrides = {}, configOverrides: Partial<Config> = {}): Promise<TestServer> {
  const config: Config = {
    production: false,
    host: "127.0.0.1",
    port: 0,
    databaseUrl: TEST_DATABASE_URL,
    allowedOrigins: new Set([ORIGIN]),
    trustProxy: 0,
    webDist: null,
    voiceIceServers: [],
    trivia: TRIVIA_DEFAULTS,
    ...configOverrides,
  };
  const built = await buildApp(config, { logger: false, profileWritesPerMinute: 10_000, ...overrides });
  await built.app.listen({ host: "127.0.0.1", port: 0 });
  const { port } = built.app.server.address() as AddressInfo;
  return { ...built, base: `http://127.0.0.1:${port}`, wsUrl: `ws://127.0.0.1:${port}/ws` };
}

/** Extracts `name=value` of the session cookie from a response, if set. */
export function sessionCookie(res: Response): string | null {
  for (const header of res.headers.getSetCookie()) {
    const pair = header.split(";")[0] ?? "";
    if (pair.startsWith("ghostel_sid=")) return pair;
  }
  return null;
}

export async function putMe(server: TestServer, body: unknown, cookie?: string, origin: string | null = ORIGIN) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers["cookie"] = cookie;
  if (origin) headers["origin"] = origin;
  const res = await fetch(`${server.base}/api/me`, { method: "PUT", headers, body: JSON.stringify(body) });
  return { res, json: (await res.json()) as Record<string, unknown> };
}

export async function getMe(server: TestServer, cookie?: string) {
  const res = await fetch(`${server.base}/api/me`, { headers: cookie ? { cookie } : {} });
  return { res, json: (await res.json()) as { guest: { name: string; look: unknown } | null } };
}

export interface TestSocket {
  ws: WebSocket;
  messages: ServerMessage[];
  next: <T extends ServerMessage["t"]>(
    type: T,
    where?: (m: Extract<ServerMessage, { t: T }>) => boolean,
    timeoutMs?: number,
  ) => Promise<Extract<ServerMessage, { t: T }>>;
  send: (data: unknown) => void;
  closed: Promise<{ code: number }>;
}

export function openSocket(server: TestServer, cookie: string, origin = ORIGIN): Promise<TestSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(server.wsUrl, { headers: { cookie, origin } });
    const messages: ServerMessage[] = [];
    const waiters: { test: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] = [];
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString()) as ServerMessage;
      messages.push(msg);
      for (const w of [...waiters]) {
        if (w.test(msg)) {
          waiters.splice(waiters.indexOf(w), 1);
          w.resolve(msg);
        }
      }
    });
    const closed = new Promise<{ code: number }>((r) => ws.on("close", (code) => r({ code })));
    ws.on("unexpected-response", (_req, res) => reject(new Error(`HTTP ${res.statusCode}`)));
    ws.on("error", reject);
    ws.on("open", () =>
      resolve({
        ws,
        messages,
        closed,
        send: (data) => ws.send(typeof data === "string" ? data : JSON.stringify(data)),
        next: (type, where, timeoutMs = 2000) =>
          new Promise((res, rej) => {
            const test = (m: ServerMessage) => m.t === type && (!where || where(m as never));
            const seen = messages.find(test);
            if (seen) return res(seen as never);
            const timer = setTimeout(() => rej(new Error(`Timed out waiting for ${type}`)), timeoutMs);
            waiters.push({
              test,
              resolve: (m) => {
                clearTimeout(timer);
                res(m as never);
              },
            });
          }),
      }),
    );
  });
}

/** Resolves with the HTTP status of a refused WebSocket upgrade. */
export function upgradeStatus(server: TestServer, headers: Record<string, string>): Promise<number> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(server.wsUrl, { headers });
    ws.on("unexpected-response", (_req, res) => {
      resolve(res.statusCode ?? 0);
      ws.terminate();
    });
    ws.on("open", () => {
      ws.close();
      reject(new Error("upgrade unexpectedly succeeded"));
    });
    ws.on("error", () => undefined);
  });
}

/** Generic JSON API call with a session cookie and the allowed Origin. */
export async function api(server: TestServer, method: string, path: string, cookie?: string, body?: unknown) {
  const headers: Record<string, string> = { origin: ORIGIN };
  if (cookie) headers["cookie"] = cookie;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(`${server.base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  // `any` is a test-only convenience: responses are asserted structurally with expect().
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { res, text, json: (text ? JSON.parse(text) : null) as Record<string, any> | null };
}
