import { existsSync } from "node:fs";
import { PAIRS_DEFAULTS, PAIRS_FAST, TRIVIA_DEFAULTS, TRIVIA_FAST, iceServersSchema, type IceServer, type PairsConfig, type TriviaConfig } from "@ghostel/shared";
import { fileURLToPath } from "node:url";

export interface Config {
  production: boolean;
  host: string;
  port: number;
  databaseUrl: string;
  allowedOrigins: ReadonlySet<string>;
  /**
   * Number of reverse-proxy hops whose X-Forwarded-For entries are trusted (0 = none).
   * A hop count, not `true`: trusting the whole header would let clients spoof their IP and dodge rate limits.
   */
  trustProxy: number;
  /** Directory with the built web app, served same-origin when present. */
  webDist: string | null;
  /** STUN/TURN servers handed to browsers for voice (VOICE_ICE_SERVERS, JSON array). */
  voiceIceServers: IceServer[];
  /** Pumpkin Trivia timings. TRIVIA_FAST=1 gives short games (Trivia and Monster Pairs) for automated browser tests. */
  trivia: TriviaConfig;
  /** Monster Pairs size and timings (short with TRIVIA_FAST=1). */
  pairs: PairsConfig;
}

const DEFAULT_ICE: IceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

function parseHops(raw: string | undefined): number {
  if (raw === undefined || raw === "") return 0;
  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 0 || hops > 5) throw new Error(`TRUST_PROXY must be a hop count 0–5, got "${raw}"`);
  return hops;
}

function parseIceServers(raw: string | undefined): IceServer[] {
  if (raw === undefined || raw.trim() === "") return DEFAULT_ICE;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("VOICE_ICE_SERVERS must be a JSON array, e.g. [{\"urls\":\"stun:stun.l.google.com:19302\"}]");
  }
  const parsed = iceServersSchema.safeParse(data);
  if (!parsed.success) throw new Error("VOICE_ICE_SERVERS has an invalid entry (expected { urls, username?, credential? }).");
  return parsed.data;
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing required environment variable ${key}. See .env.example.`);
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env["NODE_ENV"] === "production";
  const port = Number(env["PORT"] ?? "2590");
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error(`Invalid PORT: ${env["PORT"]}`);
  const origins = required(env, "ALLOWED_ORIGINS")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const defaultDist = fileURLToPath(new URL("../../web/dist", import.meta.url));
  const webDist = env["WEB_DIST"] ?? defaultDist;
  return {
    production,
    host: env["HOST"] ?? (production ? "0.0.0.0" : "127.0.0.1"),
    port,
    databaseUrl: required(env, "DATABASE_URL"),
    allowedOrigins: new Set(origins),
    trustProxy: parseHops(env["TRUST_PROXY"]),
    webDist: existsSync(webDist) ? webDist : null,
    voiceIceServers: parseIceServers(env["VOICE_ICE_SERVERS"]),
    trivia: env["TRIVIA_FAST"] === "1" ? TRIVIA_FAST : TRIVIA_DEFAULTS,
    pairs: env["TRIVIA_FAST"] === "1" ? PAIRS_FAST : PAIRS_DEFAULTS,
  };
}
