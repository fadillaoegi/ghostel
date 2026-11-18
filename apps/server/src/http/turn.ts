import { createHmac } from "node:crypto";
import type { IceServer } from "@ghostel/shared";
import type { TurnConfig } from "../config";

/**
 * Short-lived TURN credentials (the TURN REST API scheme coturn checks with `use-auth-secret`):
 * username "<expiry unix seconds>:ghostel", credential base64(HMAC-SHA1(secret, username)).
 * coturn refuses them after the expiry. The guest ID is deliberately not part of the username.
 * Kept free of Fastify so scripts/turn-probe.ts can use the exact same code.
 */
export function turnCredentials(turn: TurnConfig, nowMs: number): IceServer {
  const username = `${Math.floor(nowMs / 1000) + turn.ttlSeconds}:ghostel`;
  const credential = createHmac("sha1", turn.secret).update(username).digest("base64");
  return { urls: turn.urls, username, credential };
}
