import fastifyCookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import { ROOM_CAPACITY, createGameRegistry, isRoomId, type EnterFailCode, type TriviaConfig } from "@ghostel/shared";
import Fastify, { type FastifyInstance } from "fastify";
import type { Config } from "./config";
import { GuestRepository } from "./db/guests";
import { migrate } from "./db/migrate";
import { CONCIERGE_ID, ensureHouseRooms } from "./db/house";
import { createPool, type Pool } from "./db/pool";
import { RoomRepository, toPublicRoom } from "./db/rooms";
import { makeGuestResolver } from "./http/auth";
import { RateLimiter } from "./http/rate-limit";
import { registerRoomRoutes } from "./http/rooms";
import { registerRoutes } from "./http/routes";
import { registerVoiceRoutes } from "./http/voice";
import { registerSlideRoutes } from "./http/slides";
import { hashSessionToken, isWellFormedToken, sessionCookieName } from "./http/session";
import { PresenceHub, type GateResult, type HubOptions, type RoomGate } from "./realtime/hub";
import { attachWebSocket } from "./realtime/upgrade";
import { verifyPassword } from "./security/passwords";

export interface AppOverrides {
  hub?: Partial<HubOptions>;
  profileWritesPerMinute?: number;
  roomWritesPerMinute?: number;
  slideUploadsPerMinute?: number;
  /** Password attempts per guest and room per minute. */
  passwordAttemptsPerMinute?: number;
  /** Overrides config.trivia (tests). */
  trivia?: TriviaConfig;
  logger?: boolean;
}

const ENTER_MESSAGES: Record<EnterFailCode, string> = {
  not_found: "That room no longer exists.",
  locked: "This room is locked by its owner.",
  password_required: "This room needs a password.",
  wrong_password: "Wrong password.",
  too_many_attempts: "Too many guesses. Wait a minute and try again.",
  full: `This room is full (${ROOM_CAPACITY} guests).`,
};

const fail = (code: EnterFailCode): GateResult => ({ ok: false, code, message: ENTER_MESSAGES[code] });

/** Server-side room entry rules. Passwords are compared against argon2id hashes only. */
function createRoomGate(rooms: RoomRepository, attemptsPerMinute: number): RoomGate {
  const attempts = new RateLimiter(attemptsPerMinute, 60_000);
  return {
    async check({ guestId, roomId, password, occupants }) {
      if (!isRoomId(roomId)) return fail("not_found");
      const room = await rooms.findForEntry(roomId);
      if (!room) return fail("not_found");
      const owner = room.ownerId === guestId;
      if (!owner) {
        if (occupants >= room.capacity) return { ok: false, code: "full", message: `This room is full (${room.capacity} guests).` };
        if (room.access === "locked") return fail("locked");
        if (room.access === "password") {
          if (!password) return fail("password_required");
          if (!attempts.take(`${guestId}:${roomId}`)) return fail("too_many_attempts");
          const ok = room.passwordHash !== null && (await verifyPassword(room.passwordHash, password.normalize("NFC")));
          if (!ok) return fail("wrong_password");
        }
      }
      rooms.markUsed(room.id).catch(() => undefined);
      return { ok: true, room: toPublicRoom(room), owner };
    },
  };
}

const STALE_ROOM_DAYS = 3;

export interface GhostelApp {
  app: FastifyInstance;
  hub: PresenceHub;
  pool: Pool;
  close: () => Promise<void>;
}

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join("; ");

export async function buildApp(config: Config, overrides: AppOverrides = {}): Promise<GhostelApp> {
  const pool = createPool(config.databaseUrl);
  await migrate(pool);
  await ensureHouseRooms(pool);
  const guests = new GuestRepository(pool);
  const rooms = new RoomRepository(pool);
  const hub = new PresenceHub(
    overrides.hub,
    createRoomGate(rooms, overrides.passwordAttemptsPerMinute ?? 5),
    createGameRegistry({ trivia: overrides.trivia ?? config.trivia }),
    { add: (guestId, candy) => guests.addCandy(guestId, candy) },
  );
  const resolveGuest = makeGuestResolver(guests, config.production);

  const app = Fastify({
    logger: overrides.logger ?? { level: config.production ? "info" : "warn" },
    // Trust only the nearest `trustProxy` hops (hop 0 is the socket peer); 0 trusts no proxy headers.
    trustProxy: (_address: string, hop: number) => hop < config.trustProxy,
    bodyLimit: 16 * 1024,
  });

  await app.register(fastifyCookie);

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Frame-Options", "DENY");
    // Camera, microphone and screen capture for this origin only (still opt-in per click); nothing else.
    reply.header("Permissions-Policy", "camera=(self), microphone=(self), display-capture=(self), geolocation=()");
    const type = String(reply.getHeader("content-type") ?? "");
    if (type.startsWith("text/html")) reply.header("Content-Security-Policy", CONTENT_SECURITY_POLICY);
    return payload;
  });

  registerRoutes(app, {
    guests,
    hub,
    production: config.production,
    allowedOrigins: config.allowedOrigins,
    profileWritesPerMinute: overrides.profileWritesPerMinute ?? 30,
    resolveGuest,
  });
  registerRoomRoutes(app, { rooms, hub, resolveGuest, writesPerMinute: overrides.roomWritesPerMinute ?? 30 });
  registerVoiceRoutes(app, { resolveGuest, iceServers: config.voiceIceServers });
  registerSlideRoutes(app, { hub, resolveGuest, uploadsPerMinute: overrides.slideUploadsPerMinute ?? 6 });

  if (config.webDist) {
    await app.register(fastifyStatic, {
      root: config.webDist,
      wildcard: false,
      setHeaders(reply, filePath) {
        if (filePath.includes("/assets/")) reply.header("Cache-Control", "public, max-age=31536000, immutable");
        else reply.header("Cache-Control", "no-cache");
      },
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === "GET" && !request.url.startsWith("/api/") && !request.url.startsWith("/ws")) {
        return reply.header("Cache-Control", "no-cache").sendFile("index.html");
      }
      return reply.code(404).send({ error: "not_found" });
    });
  }

  const cookieName = sessionCookieName(config.production);
  attachWebSocket({
    server: app.server,
    hub,
    allowedOrigins: config.allowedOrigins,
    authenticate: async (request) => {
      const cookies = app.parseCookie(request.headers.cookie ?? "");
      const token = cookies[cookieName];
      if (!isWellFormedToken(token)) return null;
      return guests.findByTokenHash(hashSessionToken(token));
    },
    onConnected: (guest) => {
      guests.touch(guest.id).catch((error: unknown) => app.log.warn({ error }, "touch failed"));
    },
  });

  hub.setRooms((await rooms.list(200)).map(toPublicRoom));
  // Doors must not run out during judging: release guest rooms nobody used for a few days.
  const releaseStale = async () => {
    const released = await rooms.releaseStale(STALE_ROOM_DAYS, CONCIERGE_ID, hub.occupiedRoomIds());
    for (const id of released) hub.closeRoom(id);
  };
  await releaseStale().catch((error: unknown) => app.log.warn({ error }, "stale room cleanup failed"));
  const cleanupTimer = setInterval(() => {
    releaseStale().catch((error: unknown) => app.log.warn({ error }, "stale room cleanup failed"));
  }, 60 * 60 * 1000);
  cleanupTimer.unref();

  hub.start();

  return {
    app,
    hub,
    pool,
    close: async () => {
      clearInterval(cleanupTimer);
      hub.stop();
      await app.close();
      await pool.end();
    },
  };
}
