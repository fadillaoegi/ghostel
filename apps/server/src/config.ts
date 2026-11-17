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
  /** Own TURN relay (coturn with use-auth-secret): short-lived credentials per request. Null when not configured. */
  turn: TurnConfig | null;
  /** Pumpkin Trivia timings. TRIVIA_FAST=1 gives short games (Trivia and Monster Pairs) for automated browser tests. */
  trivia: TriviaConfig;
  /** Monster Pairs size and timings (short with TRIVIA_FAST=1). */
  pairs: PairsConfig;
}

const DEFAULT_ICE: IceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

export interface TurnConfig {
  urls: string[];
  secret: string;
  ttlSeconds: number;
}

/** TURN_URLS + TURN_SECRET (+ TURN_TTL_SECONDS): both or neither, turn:/turns: URLs only, a long secret in production. */
function parseTurn(env: NodeJS.ProcessEnv, production: boolean): TurnConfig | null {
  const rawUrls = env["TURN_URLS"]?.trim() ?? "";
  const secret = env["TURN_SECRET"] ?? "";
  if (rawUrls === "" && secret === "") return null;
  if (rawUrls === "" || secret === "") throw new Error("TURN_URLS and TURN_SECRET must be set together (or both left empty).");
  const urls = rawUrls
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  if (urls.length > 5) throw new Error("TURN_URLS takes at most 5 URLs.");
  for (const u of urls) {
    if (!/^turns?:[^\s]+$/.test(u) || u.length > 300) throw new Error(`TURN_URLS entries must start with turn: or turns:, got "${u}".`);
  }
  if (production && secret.length < 32) throw new Error("TURN_SECRET must be at least 32 characters in production (e.g. openssl rand -hex 32).");
  const ttlRaw = env["TURN_TTL_SECONDS"];
  const ttlSeconds = ttlRaw === undefined || ttlRaw === "" ? 6 * 3600 : Number(ttlRaw);
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 600 || ttlSeconds > 86_400) {
    throw new Error(`TURN_TTL_SECONDS must be a whole number of seconds from 600 to 86400, got "${ttlRaw}".`);
  }
  return { urls, secret, ttlSeconds };
}

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

/**
 * Production must be served over HTTPS (Secure `__Host-` cookie, camera and microphone). Only
 * http://localhost and http://127.0.0.1 are accepted as well, for the local production smoke test.
 */
function checkProductionOrigins(origins: readonly string[]): void {
  for (const origin of origins) {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new Error(`ALLOWED_ORIGINS has an invalid entry "${origin}". Use the full address, e.g. https://ghostel.example.com`);
    }
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
      throw new Error(`ALLOWED_ORIGINS must use https:// in production, got "${origin}".`);
    }
    if (url.origin !== origin) throw new Error(`ALLOWED_ORIGINS entries are bare origins without a path or trailing slash: use "${url.origin}".`);
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env["NODE_ENV"] === "production";
  const port = Number(env["PORT"] ?? "8108");
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error(`Invalid PORT: ${env["PORT"]}`);
  const origins = required(env, "ALLOWED_ORIGINS")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const defaultDist = fileURLToPath(new URL("../../web/dist", import.meta.url));
  const webDist = env["WEB_DIST"] ?? defaultDist;
  if (production) {
    checkProductionOrigins(origins);
    if (env["TRIVIA_FAST"] === "1") throw new Error("TRIVIA_FAST is for automated tests only. Remove it from the production environment.");
  }
  return {
    production,
    host: env["HOST"] ?? (production ? "0.0.0.0" : "127.0.0.1"),
    port,
    databaseUrl: required(env, "DATABASE_URL"),
    allowedOrigins: new Set(origins),
    trustProxy: parseHops(env["TRUST_PROXY"]),
    webDist: existsSync(webDist) ? webDist : null,
    voiceIceServers: parseIceServers(env["VOICE_ICE_SERVERS"]),
    turn: parseTurn(env, production),
    trivia: env["TRIVIA_FAST"] === "1" ? TRIVIA_FAST : TRIVIA_DEFAULTS,
    pairs: env["TRIVIA_FAST"] === "1" ? PAIRS_FAST : PAIRS_DEFAULTS,
  };
}
