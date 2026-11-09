import { crownUnlocked, parseProfileInput } from "@ghostel/shared";
import type { FastifyInstance } from "fastify";
import type { GuestRepository } from "../db/guests";
import type { PresenceHub } from "../realtime/hub";
import type { GuestResolver } from "./auth";
import { RateLimiter } from "./rate-limit";
import { hashSessionToken, newSessionToken, sessionCookieName, sessionCookieOptions } from "./session";

export interface RouteDeps {
  guests: GuestRepository;
  hub: PresenceHub;
  production: boolean;
  allowedOrigins: ReadonlySet<string>;
  profileWritesPerMinute: number;
  resolveGuest: GuestResolver;
}

export function registerRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const cookieName = sessionCookieName(deps.production);
  const profileWrites = new RateLimiter(deps.profileWritesPerMinute, 60_000);

  const currentGuest = deps.resolveGuest;

  // Cross-site request protection: every non-GET API call must come from an allowed Origin.
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/")) return;
    if (request.method === "GET" || request.method === "HEAD") return;
    const origin = request.headers.origin;
    if (!origin || !deps.allowedOrigins.has(origin)) {
      return reply.code(403).send({ error: "forbidden_origin", message: "Request origin is not allowed." });
    }
  });

  app.get("/api/health", async () => ({ ok: true }));

  app.get("/api/me", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const guest = await currentGuest(request);
    return { guest: guest ? { name: guest.name, look: guest.look, candies: guest.candies } : null };
  });

  app.put("/api/me", { bodyLimit: 4096 }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (!profileWrites.take(request.ip)) {
      return reply.code(429).send({ error: "rate_limited", message: "Too many changes. Try again in a minute." });
    }
    const input = parseProfileInput(request.body);
    if (!input.ok) {
      return reply.code(400).send({ error: "invalid_profile", field: input.field, message: input.message });
    }
    const existing = await currentGuest(request);
    // The Golden Crown is a reward for finding every candy; the server is the only judge of that.
    if (input.value.look.hat === "crown" && !crownUnlocked(existing?.candies ?? [])) {
      return reply.code(400).send({
        error: "invalid_profile",
        field: "look",
        message: "The Golden Crown unlocks after you find all 12 candies in the hotel.",
      });
    }
    let guest;
    if (existing) {
      guest = await deps.guests.updateProfile(existing.id, input.value);
    } else {
      const token = newSessionToken();
      guest = await deps.guests.create(hashSessionToken(token), input.value);
      reply.setCookie(cookieName, token, sessionCookieOptions(deps.production));
    }
    deps.hub.updateProfile(guest.id, { name: guest.name, look: guest.look });
    return { guest: { name: guest.name, look: guest.look, candies: guest.candies } };
  });
}
