import { z } from "zod";
import type { ChatMessage } from "./chat";
import type { Look } from "./profile";
import type { GameView } from "./games/index";
import type { DoorInfo } from "./doors";
import type { UpperFloor } from "./floors";
import type { SnackId } from "./canteen";
import type { EnterFailCode, PublicRoom } from "./rooms";
import { voiceSignalDataSchema, type VoiceSignalData } from "./voice";
import { PRESENT_MODES, SLIDES_MAX_PAGES, streamIdSchema, type CallState, type PresentRequest, type PresentationView } from "./calls";

/** Max bytes accepted in one WebSocket frame from a client (SDP offers need a few KB). */
export const MAX_CLIENT_FRAME_BYTES = 16 * 1024;
/** Server broadcast rate for position snapshots. */
export const SNAPSHOT_HZ = 15;
/** Client send rate for its own position. */
export const CLIENT_MOVE_HZ = 20;

const coordinate = z.number().min(-1e4).max(1e4);

export const clientMessageSchema = z.discriminatedUnion("t", [
  // `e` is the scene epoch from the latest welcome; moves from a previous scene are dropped.
  z.strictObject({
    t: z.literal("move"),
    x: coordinate,
    z: coordinate,
    ry: z.number().min(-100).max(100),
    e: z.number().int().min(0).max(1e9).optional(),
  }),
  // Loose cap here; the real limit (CHAT_MAX characters after normalising) is applied by validateChat.
  z.strictObject({ t: z.literal("chat"), text: z.string().max(1000) }),
  // Room ID format and password rules are checked by the server's access check.
  z.strictObject({ t: z.literal("enter"), room: z.string().max(64), password: z.string().max(300).optional() }),
  z.strictObject({ t: z.literal("exit") }),
  z.strictObject({ t: z.literal("floor"), floor: z.number().int().min(1).max(5) }),
  // Snack id is checked against the menu (and the counter distance) by the server.
  z.strictObject({ t: z.literal("order"), snack: z.string().min(1).max(40) }),
  z.strictObject({ t: z.literal("collect"), candy: z.string().min(1).max(40) }),
  // Seats: the server checks the table, the chair and the distance.
  z.strictObject({ t: z.literal("sit"), table: z.string().min(1).max(12), seat: z.number().int().min(0).max(7) }),
  z.strictObject({ t: z.literal("stand") }),
  // Call media state; stream ids let others tell the camera from a screen share.
  z.strictObject({ t: z.literal("media"), mic: z.boolean(), cam: streamIdSchema.nullable(), screen: streamIdSchema.nullable() }),
  z.strictObject({ t: z.literal("signal"), to: z.string().min(1).max(32), data: voiceSignalDataSchema }),
  // Presentations: anyone seated at a room's long table may ask; only the owner, seated, decides (checked on the server, M20).
  z.strictObject({ t: z.literal("present_request"), mode: z.enum(PRESENT_MODES) }),
  z.strictObject({ t: z.literal("present_decide"), id: z.string().min(1).max(32), allow: z.boolean() }),
  z.strictObject({ t: z.literal("present_stop") }),
  z.strictObject({ t: z.literal("present_page"), page: z.number().int().min(1).max(SLIDES_MAX_PAGES), pages: z.number().int().min(1).max(SLIDES_MAX_PAGES) }),
  z.strictObject({ t: z.literal("game_start") }),
  // The running game's engine validates the action (games differ).
  z.strictObject({ t: z.literal("game_action"), action: z.unknown() }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

export type ParseResult = { ok: true; msg: ClientMessage } | { ok: false; reason: string };

/** Parses one untrusted text frame from a client. */
export function parseClientMessage(raw: string): ParseResult {
  if (raw.length > MAX_CLIENT_FRAME_BYTES) return { ok: false, reason: "too_large" };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "bad_json" };
  }
  const parsed = clientMessageSchema.safeParse(data);
  if (!parsed.success) return { ok: false, reason: "bad_shape" };
  return { ok: true, msg: parsed.data };
}

export interface PublicPlayer {
  /** Per-connection public ID. Never the guest ID or session token. */
  id: string;
  name: string;
  look: Look;
  x: number;
  z: number;
  ry: number;
  /** Snack from Ghoul's Diner held right now (cleared by the server after SNACK_MS). */
  snack?: SnackId;
  /** Chair this player sits on, if any. */
  seat?: { table: string; seat: number };
}

/** Compact snapshot row: [id, x, z, ry]. */
export type SnapshotRow = [id: string, x: number, z: number, ry: number];

/** Where a connection currently is. */
export type Place = { kind: "lobby" } | { kind: "floor"; floor: UpperFloor } | { kind: "room"; room: PublicRoom; owner: boolean };

export type ServerMessage =
  | {
      t: "welcome";
      selfId: string;
      /** Increases on every scene change; echo it in moves. */
      epoch: number;
      place: Place;
      players: PublicPlayer[];
      chat: ChatMessage[];
      game: GameView | null;
      /** Candy ids this guest has found (all floors). */
      candies: string[];
      /** Room doors on this floor (empty in rooms and on floors 4 and 5). */
      doors: DoorInfo[];
    }
  | { t: "join"; player: PublicPlayer }
  | { t: "leave"; id: string }
  | { t: "snap"; p: SnapshotRow[] }
  | { t: "profile"; id: string; name: string; look: Look }
  | { t: "correct"; x: number; z: number }
  | { t: "chat"; msg: ChatMessage }
  | { t: "enter_failed"; code: EnterFailCode; message: string }
  /** Room settings changed while you are inside. */
  | { t: "room"; room: PublicRoom }
  /** Informational message, e.g. "The owner closed this room." */
  | { t: "notice"; message: string }
  /** Someone in this channel sat down (table/seat) or stood up (null). */
  | { t: "seat"; id: string; table: string | null; seat: number | null }
  | { t: "seat_denied"; message: string }
  /** Your call (room or table) and its members; null when you are in no call. */
  | { t: "call"; call: CallState | null }
  | { t: "signal"; from: string; data: VoiceSignalData }
  /** The room's presentation (screen share or PDF slides); null when nobody presents. */
  | { t: "presentation"; p: PresentationView | null }
  /** Owners only: guests asking to present. */
  | { t: "present_requests"; requests: PresentRequest[] }
  /** The room's game as this connection may see it; null when no game runs. */
  | { t: "game"; view: GameView | null }
  | { t: "game_denied"; message: string }
  /** Sent to every tab of the guest when their candy list changes. */
  | { t: "candies"; found: string[] }
  /** Someone on this floor found a candy. */
  | { t: "candy_found"; id: string; name: string }
  /** A door on this floor changed (room created, renamed, locked, deleted, or someone went in or out). */
  | { t: "doors"; doors: DoorInfo[] }
  /** Someone in this channel started (snack) or stopped (null) holding a Diner snack. */
  | { t: "snack"; id: string; name: string; snack: SnackId | null }
  | { t: "error"; code: ErrorCode; message: string };

export type ErrorCode = "chat_invalid" | "chat_rate_limited";

/** WebSocket close codes used by the server (4000–4999 are application codes). */
export const CloseCode = {
  TooManyInvalid: 4001,
  RateLimited: 4002,
} as const;
