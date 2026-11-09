import { z } from "zod";

/**
 * Calls are peer-to-peer WebRTC meshes relayed by the server. A call is either a room (everyone
 * inside) or one table on a floor (exactly the guests seated there). Members send their media
 * state; the server tells every member who else is in the call.
 */

/** WebRTC MediaStream ids as browsers generate them (UUIDs, sometimes in braces). */
export const STREAM_ID = /^[A-Za-z0-9{}-]{1,64}$/;
export const streamIdSchema = z.string().regex(STREAM_ID);

export interface CallMember {
  /** Public connection id. */
  id: string;
  name: string;
  mic: boolean;
  /** MediaStream id of the camera, null when the camera is off. */
  cam: string | null;
  /** MediaStream id of a screen share (approved presenter only), null otherwise. */
  screen: string | null;
  /** Seat at the call's table, if seated. */
  seat: number | null;
}

export interface CallState {
  kind: "room" | "table";
  /** Table id for table calls ("long" for a room's table is not used: room calls cover the room). */
  table: string | null;
  members: CallMember[];
}

/** Largest call: a full room (8) plus its owner, who may enter a full room. */
export const CALL_MAX_MEMBERS = 9;

/** Camera tiles are small; keep the mesh light. */
export const CAMERA_CONSTRAINTS = { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 20 } } as const;
export const SCREEN_CONSTRAINTS = { width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 }, frameRate: { ideal: 8, max: 15 } } as const;

// ---- presentations (rooms only) ----

export const PRESENT_MODES = ["screen", "pdf"] as const;
export type PresentMode = (typeof PRESENT_MODES)[number];
/** PDF slides are kept in server memory only, and only this big. */
export const SLIDES_MAX_BYTES = 10 * 1024 * 1024;
export const SLIDES_MAX_PAGES = 2000;

/** What everyone in the room knows about the current presentation. */
export interface PresentationView {
  /** Public connection id of the presenter. */
  presenter: string;
  name: string;
  mode: PresentMode;
  /** PDF only: current page (1-based) and page count once the presenter's viewer knows it. */
  page: number;
  pages: number | null;
  /** PDF only: download token, null until the file is uploaded. */
  file: string | null;
}

export interface PresentRequest {
  id: string;
  name: string;
  mode: PresentMode;
}
