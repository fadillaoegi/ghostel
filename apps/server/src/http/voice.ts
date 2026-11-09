import type { IceServer } from "@ghostel/shared";
import type { FastifyInstance } from "fastify";
import type { GuestResolver } from "./auth";

/** ICE servers for WebRTC voice. TURN credentials (if configured) are only given to checked-in guests. */
export function registerVoiceRoutes(app: FastifyInstance, deps: { resolveGuest: GuestResolver; iceServers: IceServer[] }): void {
  app.get("/api/voice", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (!(await deps.resolveGuest(request))) {
      return reply.code(401).send({ error: "no_session", message: "Check in at the front desk first." });
    }
    return { iceServers: deps.iceServers };
  });
}
