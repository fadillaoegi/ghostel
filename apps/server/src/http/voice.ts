import { createHmac } from "node:crypto";
import type { IceServer } from "@ghostel/shared";
import type { FastifyInstance } from "fastify";
import type { TurnConfig } from "../config";
import type { GuestResolver } from "./auth";

/**
 * Short-lived TURN credentials (the TURN REST API scheme coturn checks with `use-auth-secret`):
 * username "<expiry unix seconds>:ghostel", credential base64(HMAC-SHA1(secret, username)).
 * coturn refuses them after the expiry. The guest ID is deliberately not part of the username.
 */
export function turnCredentials(turn: TurnConfig, nowMs: number): IceServer {
  const username = `${Math.floor(nowMs / 1000) + turn.ttlSeconds}:ghostel`;
  const credential = createHmac("sha1", turn.secret).update(username).digest("base64");
  return { urls: turn.urls, username, credential };
}

/** ICE servers for WebRTC calls. TURN credentials (if configured) are only given to checked-in guests. */
export function registerVoiceRoutes(
  app: FastifyInstance,
  deps: { resolveGuest: GuestResolver; iceServers: IceServer[]; turn: TurnConfig | null; now?: () => number },
): void {
  const now = deps.now ?? Date.now;
  app.get("/api/voice", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (!(await deps.resolveGuest(request))) {
      return reply.code(401).send({ error: "no_session", message: "Check in at the front desk first." });
    }
    if (!deps.turn) return { iceServers: deps.iceServers };
    return { iceServers: [...deps.iceServers, turnCredentials(deps.turn, now())], ttl: deps.turn.ttlSeconds };
  });
}
