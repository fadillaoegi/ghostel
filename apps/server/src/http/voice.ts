import type { IceServer } from "@ghostel/shared";
import type { FastifyInstance } from "fastify";
import type { TurnConfig } from "../config";
import type { GuestResolver } from "./auth";
import { turnCredentials } from "./turn";

export { turnCredentials };

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
