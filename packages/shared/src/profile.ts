import { z } from "zod";

export const NAME_MIN = 2;
export const NAME_MAX = 20;

// Starts with a letter or number; then letters, numbers, combining marks, space and - _ . '
const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} _.'-]*$/u;

export type Result<T> = { ok: true; value: T } | { ok: false; message: string };

/** NFC-normalise, collapse any whitespace run to one space, trim. */
export function normalizeName(raw: string): string {
  return raw.normalize("NFC").replace(/\s+/gu, " ").trim();
}

export function validateName(raw: unknown): Result<string> {
  if (typeof raw !== "string") return { ok: false, message: "Please enter a name." };
  // Guard against huge inputs before doing Unicode work on them.
  if (raw.length > 200) return { ok: false, message: `Name can be at most ${NAME_MAX} characters.` };
  const name = normalizeName(raw);
  const length = Array.from(name).length;
  if (length === 0) return { ok: false, message: "Please enter a name." };
  if (length < NAME_MIN) return { ok: false, message: `Name must be at least ${NAME_MIN} characters.` };
  if (length > NAME_MAX) return { ok: false, message: `Name can be at most ${NAME_MAX} characters.` };
  if (!NAME_PATTERN.test(name)) {
    return {
      ok: false,
      message: "Name can use letters, numbers, spaces and - _ . ' and must start with a letter or number.",
    };
  }
  return { ok: true, value: name };
}

export const COLORS = {
  pumpkin: "#ff7a1a",
  slime: "#7ed957",
  moon: "#f4f1de",
  violet: "#8b5cf6",
  blood: "#c81d25",
  midnight: "#2b2d42",
  teal: "#2ec4b6",
  bone: "#e9d8a6",
  rose: "#ff70a6",
  ash: "#6c757d",
} as const;
export type ColorId = keyof typeof COLORS;
export const COLOR_IDS = Object.keys(COLORS) as [ColorId, ...ColorId[]];

export const HEADS = ["round", "pumpkin", "skull", "cat", "vampire", "werewolf", "frankenstein", "zombie", "alien"] as const;
/** "crown" is a reward: the server only accepts it once all candies are found. */
export const HATS = ["none", "witch", "top", "horns", "pirate", "batears", "crown"] as const;
export const COSTUMES = ["none", "cape", "sheet", "mummy", "batwings", "skeleton", "wizard", "tattered", "fur"] as const;
export type Head = (typeof HEADS)[number];
export type Hat = (typeof HATS)[number];
export type Costume = (typeof COSTUMES)[number];

export const lookSchema = z.strictObject({
  body: z.enum(COLOR_IDS),
  accent: z.enum(COLOR_IDS),
  head: z.enum(HEADS),
  hat: z.enum(HATS),
  costume: z.enum(COSTUMES),
});
export type Look = z.infer<typeof lookSchema>;

export const DEFAULT_LOOK: Look = {
  body: "violet",
  accent: "pumpkin",
  head: "pumpkin",
  hat: "witch",
  costume: "cape",
};

export function randomLook(rng: () => number = Math.random): Look {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length) % items.length] as T;
  return {
    body: pick(COLOR_IDS),
    accent: pick(COLOR_IDS),
    head: pick(HEADS),
    hat: pick(HATS),
    costume: pick(COSTUMES),
  };
}

export interface Profile {
  name: string;
  look: Look;
}

export type ProfileInputResult =
  | { ok: true; value: Profile }
  | { ok: false; field: "name" | "look" | "body"; message: string };

/** Validates an untrusted `{ name, look }` request body. */
export function parseProfileInput(body: unknown): ProfileInputResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, field: "body", message: "Expected a JSON object with name and look." };
  }
  const record = body as Record<string, unknown>;
  const name = validateName(record["name"]);
  if (!name.ok) return { ok: false, field: "name", message: name.message };
  const look = lookSchema.safeParse(record["look"]);
  if (!look.success) return { ok: false, field: "look", message: "That costume is not available." };
  return { ok: true, value: { name: name.value, look: look.data } };
}
