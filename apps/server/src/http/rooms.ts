import { MAX_ROOMS_PER_GUEST, ROOM_CAPACITY_DEFAULT, isRoomId, parseRoomInput, type RoomSummary } from "@ghostel/shared";
import type { FastifyInstance, FastifyReply } from "fastify";
import { NoFreeDoorError, toPublicRoom, type RoomRecord, type RoomRepository } from "../db/rooms";
import type { PresenceHub } from "../realtime/hub";
import { hashPassword } from "../security/passwords";
import type { GuestResolver } from "./auth";
import { RateLimiter } from "./rate-limit";

export interface RoomRouteDeps {
  rooms: RoomRepository;
  hub: PresenceHub;
  resolveGuest: GuestResolver;
  writesPerMinute: number;
}

const unauthorized = (reply: FastifyReply) =>
  reply.code(401).send({ error: "no_session", message: "Check in at the front desk first." });
const notFound = (reply: FastifyReply) => reply.code(404).send({ error: "not_found", message: "That room does not exist." });
const notOwner = (reply: FastifyReply) =>
  reply.code(403).send({ error: "not_owner", message: "Only the room's owner can change it." });

export function registerRoomRoutes(app: FastifyInstance, deps: RoomRouteDeps): void {
  const writes = new RateLimiter(deps.writesPerMinute, 60_000);

  const summary = (room: RoomRecord, guestId: string): RoomSummary => ({
    ...toPublicRoom(room),
    occupants: deps.hub.occupancy(room.id),
    mine: room.ownerId === guestId,
  });

  app.get("/api/rooms", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const guest = await deps.resolveGuest(request);
    if (!guest) return unauthorized(reply);
    const rooms = (await deps.rooms.list(50)).map((r) => summary(r, guest.id));
    // Busy rooms first; the list is already newest-first.
    rooms.sort((a, b) => b.occupants - a.occupants);
    return { rooms };
  });

  app.post("/api/rooms", { bodyLimit: 4096 }, async (request, reply) => {
    const guest = await deps.resolveGuest(request);
    if (!guest) return unauthorized(reply);
    if (!writes.take(request.ip)) return reply.code(429).send({ error: "rate_limited", message: "Too many changes. Try again in a minute." });
    const input = parseRoomInput(request.body, "create");
    if (!input.ok) return reply.code(400).send({ error: "invalid_room", field: input.field, message: input.message });
    if ((await deps.rooms.countByOwner(guest.id)) >= MAX_ROOMS_PER_GUEST) {
      return reply.code(409).send({
        error: "room_limit",
        message: `You can own at most ${MAX_ROOMS_PER_GUEST} rooms. Delete one first.`,
      });
    }
    const v = input.value;
    let room: RoomRecord;
    try {
      room = await deps.rooms.create(
        guest.id,
        {
          name: v.name as string,
          access: v.access ?? "open",
          passwordHash: v.access === "password" && v.password ? await hashPassword(v.password) : null,
          decor: v.decor ?? "crypt",
          game: v.game ?? "none",
          capacity: v.capacity ?? ROOM_CAPACITY_DEFAULT,
        },
        { ...(v.floor ? { floor: v.floor } : {}), ...(v.slot ? { slot: v.slot } : {}) },
      );
    } catch (error) {
      if (!(error instanceof NoFreeDoorError)) throw error;
      const message = error.slot
        ? `Door ${error.floor}${error.slot} is already taken. Pick another door.`
        : error.floor
          ? `Floor ${error.floor} is fully booked. Try another floor.`
          : "Every door in the hotel is taken right now. Try again later.";
      return reply.code(409).send({ error: error.slot ? "door_taken" : "floor_full", message });
    }
    deps.hub.roomCreated(toPublicRoom(room));
    return reply.code(201).send({ room: summary(room, guest.id) });
  });

  app.patch<{ Params: { id: string } }>("/api/rooms/:id", { bodyLimit: 4096 }, async (request, reply) => {
    const guest = await deps.resolveGuest(request);
    if (!guest) return unauthorized(reply);
    if (!isRoomId(request.params.id)) return notFound(reply);
    if (!writes.take(request.ip)) return reply.code(429).send({ error: "rate_limited", message: "Too many changes. Try again in a minute." });
    const input = parseRoomInput(request.body, "update");
    if (!input.ok) return reply.code(400).send({ error: "invalid_room", field: input.field, message: input.message });
    const current = await deps.rooms.findForEntry(request.params.id);
    if (!current) return notFound(reply);
    if (current.ownerId !== guest.id) return notOwner(reply);

    const v = input.value;
    const access = v.access ?? current.access;
    let passwordHash: string | null | undefined;
    if (access === "password") {
      if (v.password) passwordHash = await hashPassword(v.password);
      else if (current.passwordHash === null) {
        return reply.code(400).send({ error: "invalid_room", field: "password", message: "Set a password for this room." });
      }
    } else {
      if (v.password) {
        return reply
          .code(400)
          .send({ error: "invalid_room", field: "password", message: "A password only applies to password-protected rooms." });
      }
      passwordHash = null;
    }
    const patch: Parameters<RoomRepository["update"]>[1] = { access };
    if (v.name !== undefined) patch.name = v.name;
    if (v.decor !== undefined) patch.decor = v.decor;
    if (v.game !== undefined) patch.game = v.game;
    if (passwordHash !== undefined) patch.passwordHash = passwordHash;
    const updated = await deps.rooms.update(current.id, patch);
    if (!updated) return notFound(reply);
    deps.hub.updateRoom(toPublicRoom(updated));
    return { room: summary(updated, guest.id) };
  });

  app.delete<{ Params: { id: string } }>("/api/rooms/:id", async (request, reply) => {
    const guest = await deps.resolveGuest(request);
    if (!guest) return unauthorized(reply);
    if (!isRoomId(request.params.id)) return notFound(reply);
    const current = await deps.rooms.find(request.params.id);
    if (!current) return notFound(reply);
    if (current.ownerId !== guest.id) return notOwner(reply);
    await deps.rooms.delete(current.id);
    deps.hub.closeRoom(current.id);
    return reply.code(204).send();
  });
}
