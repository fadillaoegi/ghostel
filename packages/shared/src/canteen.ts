import type { Vec2 } from "./layout";

/** What Ghoul's Diner serves. Ids are the wire format; names and emoji are shown to guests. */
export const SNACKS = [
  { id: "pumpkin_pie", name: "Pumpkin Pie", emoji: "🥧" },
  { id: "eyeball_soda", name: "Eyeball Soda", emoji: "🧃" },
  { id: "worm_noodles", name: "Worm Noodles", emoji: "🍜" },
  { id: "ghost_marshmallow", name: "Ghost Marshmallow", emoji: "👻" },
  { id: "brain_jelly", name: "Brain Jelly", emoji: "🧠" },
  { id: "bat_cookie", name: "Bat Cookie", emoji: "🍪" },
] as const;

export type SnackId = (typeof SNACKS)[number]["id"];
export const SNACK_IDS: readonly SnackId[] = SNACKS.map((s) => s.id);

export function isSnackId(value: unknown): value is SnackId {
  return typeof value === "string" && (SNACK_IDS as readonly string[]).includes(value);
}

export function snackName(id: SnackId): string {
  return SNACKS.find((s) => s.id === id)?.name ?? id;
}

/** Where guests stand to order (in front of the counter on floor 4). */
export const COUNTER_SPOT: Vec2 = { x: 2, z: -7.7 };
/** Prompt radius on the client… */
export const COUNTER_REACH = 1.9;
/** …and the server's tolerance around its own position for the guest. */
export const COUNTER_SERVER_REACH = 2.8;
/** How long a guest holds a snack. */
export const SNACK_MS = 60_000;
/** Minimum time between two orders from one connection. */
export const ORDER_COOLDOWN_MS = 3000;
