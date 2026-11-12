import { SLIDES_MAX_BYTES, isRoomId } from "@ghostel/shared";
import type { FastifyInstance } from "fastify";
import type { PresenceHub } from "../realtime/hub";
import type { GuestResolver } from "./auth";
import { RateLimiter } from "./rate-limit";

export interface SlideRouteDeps {
  hub: PresenceHub;
  resolveGuest: GuestResolver;
  uploadsPerMinute: number;
}

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * PDF slides for a room's presentation. Kept in the hub's memory only; the hub checks that the
 * uploader is the approved presenter and that downloaders are seated at the room's long table (M20).
 */
export function registerSlideRoutes(app: FastifyInstance, deps: SlideRouteDeps): void {
  const uploads = new RateLimiter(deps.uploadsPerMinute, 60_000);

  app.register(async (scope) => {
    // Raw bytes; the type header is not trusted (the hub checks the %PDF- signature).
    scope.addContentTypeParser(["application/pdf", "application/octet-stream"], { parseAs: "buffer", bodyLimit: SLIDES_MAX_BYTES }, (_req, body, done) =>
      done(null, body),
    );

    scope.post<{ Params: { id: string } }>("/api/rooms/:id/slides", { bodyLimit: SLIDES_MAX_BYTES }, async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      const guest = await deps.resolveGuest(request);
      if (!guest) return reply.code(401).send({ error: "no_session", message: "Check in at the front desk first." });
      if (!isRoomId(request.params.id)) return reply.code(404).send({ error: "not_found", message: "That room does not exist." });
      if (!uploads.take(guest.id)) return reply.code(429).send({ error: "rate_limited", message: "Too many uploads. Try again in a minute." });
      const body = request.body;
      if (!Buffer.isBuffer(body)) return reply.code(415).send({ error: "bad_file", message: "Send the PDF as application/pdf." });
      const result = deps.hub.acceptSlides(guest.id, request.params.id, body);
      if (!result.ok) return reply.code(result.status).send({ error: result.error, message: result.message });
      return reply.code(204).send();
    });

    scope.get<{ Params: { id: string; token: string } }>("/api/rooms/:id/slides/:token", async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      const guest = await deps.resolveGuest(request);
      if (!guest) return reply.code(401).send({ error: "no_session", message: "Check in at the front desk first." });
      if (!isRoomId(request.params.id) || !TOKEN.test(request.params.token)) return reply.code(404).send({ error: "not_found" });
      const data = deps.hub.slidesFor(guest.id, request.params.id, request.params.token);
      if (!data) return reply.code(404).send({ error: "not_found" });
      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", 'attachment; filename="slides.pdf"')
        .header("Content-Security-Policy", "sandbox; default-src 'none'")
        .send(data);
    });
  });
}
