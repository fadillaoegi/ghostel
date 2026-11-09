import { DOOR_SLOTS, isRoomFloor, isSlotOf, type RoomFloor } from "./doors";
import type { Result } from "./profile";

export const ROOM_ACCESS = ["open", "locked", "password"] as const;
export const ROOM_DECORS = ["crypt", "library", "ballroom"] as const;
export const ROOM_GAMES = ["none", "pumpkin_trivia"] as const;
export type RoomAccess = (typeof ROOM_ACCESS)[number];
export type RoomDecor = (typeof ROOM_DECORS)[number];
export type RoomGame = (typeof ROOM_GAMES)[number];

/** Most guests a room can hold (mesh voice and video stay small). Each room picks 2–8 when created. */
export const ROOM_CAPACITY = 8;
export const ROOM_CAPACITY_MIN = 2;
export const ROOM_CAPACITY_DEFAULT = 8;
export const MAX_ROOMS_PER_GUEST = 3;
export const ROOM_NAME_MIN = 3;
export const ROOM_NAME_MAX = 30;
export const ROOM_PASSWORD_MIN = 4;
export const ROOM_PASSWORD_MAX = 64;

/** What clients may know about a room. Never contains the password or its hash. */
export interface PublicRoom {
  id: string;
  name: string;
  ownerName: string;
  access: RoomAccess;
  decor: RoomDecor;
  game: RoomGame;
  /** Where its door is: floor 1–3 and slot letter, e.g. floor 2 slot "B" = door 2B. */
  floor: RoomFloor;
  slot: string;
  /** Guests the room holds (2–8); its long table has one chair per guest. */
  capacity: number;
}

export interface RoomSummary extends PublicRoom {
  occupants: number;
  /** True when the caller owns the room. */
  mine: boolean;
}

export type EnterFailCode = "not_found" | "locked" | "password_required" | "wrong_password" | "too_many_attempts" | "full";

const ROOM_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} _.'!?&,:-]*$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRoomId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function validateRoomName(raw: unknown): Result<string> {
  if (typeof raw !== "string" || raw.length > 300) return { ok: false, message: "Give your room a name." };
  const name = raw.normalize("NFC").replace(/\s+/gu, " ").trim();
  const length = Array.from(name).length;
  if (length === 0) return { ok: false, message: "Give your room a name." };
  if (length < ROOM_NAME_MIN) return { ok: false, message: `Room names need at least ${ROOM_NAME_MIN} characters.` };
  if (length > ROOM_NAME_MAX) return { ok: false, message: `Room names can be at most ${ROOM_NAME_MAX} characters.` };
  if (!ROOM_NAME_PATTERN.test(name)) {
    return { ok: false, message: "Room names can use letters, numbers, spaces and - _ . ' ! ? & , : and must start with a letter or number." };
  }
  return { ok: true, value: name };
}

/** Passwords are only NFC-normalised (never trimmed) so what the owner typed is what guests must type. */
export function validateRoomPassword(raw: unknown): Result<string> {
  if (typeof raw !== "string" || raw.length === 0) return { ok: false, message: "Enter a password." };
  if (raw.length > 300) return { ok: false, message: `Passwords can be at most ${ROOM_PASSWORD_MAX} characters.` };
  const password = raw.normalize("NFC");
  const length = Array.from(password).length;
  if (length < ROOM_PASSWORD_MIN) return { ok: false, message: `Passwords need at least ${ROOM_PASSWORD_MIN} characters.` };
  if (length > ROOM_PASSWORD_MAX) return { ok: false, message: `Passwords can be at most ${ROOM_PASSWORD_MAX} characters.` };
  if (/\p{Cc}/u.test(password)) return { ok: false, message: "Passwords cannot contain control characters." };
  return { ok: true, value: password };
}

export interface RoomInput {
  /** Create only: which floor (and optionally which door) the room goes behind. */
  floor?: RoomFloor;
  slot?: string;
  /** Create only: 2–8 guests. */
  capacity?: number;
  name?: string;
  access?: RoomAccess;
  /** Present only when a new password was given. */
  password?: string;
  decor?: RoomDecor;
  game?: RoomGame;
}

export type RoomInputResult = { ok: true; value: RoomInput } | { ok: false; field: string; message: string };

const ALLOWED_KEYS = new Set(["name", "access", "password", "decor", "game", "floor", "slot", "capacity"]);

function oneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

/**
 * Validates an untrusted create (all fields required except password) or update (all optional) body.
 * Whether a password is required on update depends on stored state, so the server checks that.
 */
export function parseRoomInput(body: unknown, mode: "create" | "update"): RoomInputResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, field: "body", message: "Expected a JSON object." };
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ALLOWED_KEYS.has(key)) return { ok: false, field: key, message: `Unknown field "${key.slice(0, 40)}".` };
  }
  const out: RoomInput = {};
  const has = (key: string) => record[key] !== undefined;

  if (mode === "update" && (has("floor") || has("slot"))) {
    return { ok: false, field: "floor", message: "A room cannot move to another door. Create a new room instead." };
  }
  if (has("capacity")) {
    if (mode === "update") return { ok: false, field: "capacity", message: "A room's size is set when it is created." };
    const c = record["capacity"];
    if (typeof c !== "number" || !Number.isInteger(c) || c < ROOM_CAPACITY_MIN || c > ROOM_CAPACITY) {
      return { ok: false, field: "capacity", message: `Rooms hold ${ROOM_CAPACITY_MIN} to ${ROOM_CAPACITY} guests.` };
    }
    out.capacity = c;
  }
  if (has("floor")) {
    if (!isRoomFloor(record["floor"])) return { ok: false, field: "floor", message: "Rooms are on floors 1, 2 and 3." };
    out.floor = record["floor"];
  }
  if (has("slot")) {
    if (out.floor === undefined) return { ok: false, field: "slot", message: "Pick a floor for that door." };
    const slot = record["slot"];
    if (!isSlotOf(out.floor, slot)) {
      return { ok: false, field: "slot", message: `Floor ${out.floor} has doors ${DOOR_SLOTS[out.floor].join(", ")}.` };
    }
    out.slot = slot;
  }

  if (mode === "create" || has("name")) {
    const name = validateRoomName(record["name"]);
    if (!name.ok) return { ok: false, field: "name", message: name.message };
    out.name = name.value;
  }
  for (const [key, list, label] of [
    ["access", ROOM_ACCESS, "access mode"],
    ["decor", ROOM_DECORS, "theme"],
    ["game", ROOM_GAMES, "game"],
  ] as const) {
    if (mode === "create" || has(key)) {
      const value = record[key];
      if (!oneOf<string>(list, value)) return { ok: false, field: key, message: `Pick a valid ${label}.` };
      (out as Record<string, string>)[key] = value;
    }
  }
  if (has("password") && record["password"] !== "") {
    const password = validateRoomPassword(record["password"]);
    if (!password.ok) return { ok: false, field: "password", message: password.message };
    out.password = password.value;
  }
  if (mode === "create" && out.access === "password" && out.password === undefined) {
    return { ok: false, field: "password", message: "Set a password for this room." };
  }
  if (out.password !== undefined && out.access !== undefined && out.access !== "password") {
    return { ok: false, field: "password", message: "A password only applies to password-protected rooms." };
  }
  return { ok: true, value: out };
}
