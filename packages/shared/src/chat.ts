import type { Result } from "./profile";

export const CHAT_MAX = 200;
/** Messages kept per channel per day (server memory). */
export const CHAT_HISTORY = 500;
/** Messages sent on entering a channel, shown at once, and returned per history page (M23). */
export const CHAT_PAGE = 15;
/** The chat is emptied every day at 00:00 in this offset from UTC: WIB (Asia/Jakarta, no daylight saving time). */
export const CHAT_DAY_UTC_OFFSET_HOURS = 7;

/** Day number (0 = 1970-01-01) of an epoch-milliseconds time in WIB. A new number means a new chat day. */
export function chatDay(at: number): number {
  return Math.floor((at + CHAT_DAY_UTC_OFFSET_HOURS * 3_600_000) / 86_400_000);
}
/** Per-guest chat token bucket: this many messages at once, then one every CHAT_REFILL_SECONDS. */
export const CHAT_BURST = 5;
export const CHAT_REFILL_SECONDS = 2;

export interface ChatMessage {
  id: string;
  /** Sender's public connection ID (chosen by the server). */
  from: string;
  /** Sender's display name when the message was sent. */
  name: string;
  text: string;
  /** Server time, epoch milliseconds. */
  at: number;
}

// Bidirectional overrides/isolates and marks that can visually reorder or spoof text, plus BOM.
const INVISIBLE_OR_BIDI = /[\u202A-\u202E\u2066-\u2069\u200E\u200F\u061C\uFEFF]/gu;
const CONTROL = /\p{Cc}/gu;
// "Zalgo" text: keep at most two combining marks in a row.
const MARK_RUN = /(\p{M}{2})\p{M}+/gu;

export function normalizeChat(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/\s+/gu, " ")
    .replace(CONTROL, "")
    .replace(INVISIBLE_OR_BIDI, "")
    .replace(MARK_RUN, "$1")
    .trim();
}

export function validateChat(raw: unknown): Result<string> {
  if (typeof raw !== "string") return { ok: false, message: "Type a message first." };
  const text = normalizeChat(raw);
  const length = Array.from(text).length;
  if (length === 0) return { ok: false, message: "Type a message first." };
  if (length > CHAT_MAX) return { ok: false, message: `Messages can be at most ${CHAT_MAX} characters.` };
  return { ok: true, value: text };
}
