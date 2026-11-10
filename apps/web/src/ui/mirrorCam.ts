import { CAMERA_CONSTRAINTS } from "@ghostel/shared";

/**
 * The Haunted Mirror's camera (M16). A stream of its own, video only, that stays on this device:
 * it is never given to `CallClient`, never attached to a peer and never announced to the server.
 */
export type MirrorCamStatus = "off" | "starting" | "on" | "error";

export interface MirrorCamSnapshot {
  status: MirrorCamStatus;
  video: HTMLVideoElement | null;
  error: string | null;
}

const OFF: MirrorCamSnapshot = { status: "off", video: null, error: null };

let snapshot: MirrorCamSnapshot = OFF;
let stream: MediaStream | null = null;
/** Bumped by every start and stop, so a permission prompt answered late cannot revive a stopped mirror. */
let token = 0;
const listeners = new Set<() => void>();

function set(next: MirrorCamSnapshot): void {
  snapshot = next;
  for (const l of listeners) l();
}

function release(): void {
  for (const t of stream?.getTracks() ?? []) t.stop();
  stream = null;
  if (snapshot.video) snapshot.video.srcObject = null;
}

function errorText(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "The mirror can't see you: camera access was refused.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "The mirror can't see you: no camera was found.";
  if (name === "NotReadableError") return "The mirror can't see you: the camera is busy in another app.";
  return "The mirror can't see you right now.";
}

export const mirrorCam = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): MirrorCamSnapshot {
    return snapshot;
  },
  available(): boolean {
    return typeof window !== "undefined" && window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === "function";
  },
  /** Only call from a click or tap (the permission prompt must never appear on its own). */
  async start(): Promise<void> {
    if (snapshot.status === "starting" || snapshot.status === "on") return;
    const mine = ++token;
    if (!mirrorCam.available()) {
      set({ status: "error", video: null, error: "The mirror needs a secure (HTTPS) page to use the camera." });
      return;
    }
    set({ status: "starting", video: null, error: null });
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: CAMERA_CONSTRAINTS, audio: false });
      if (mine !== token) {
        for (const t of s.getTracks()) t.stop();
        return;
      }
      stream = s;
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = s;
      for (const t of s.getVideoTracks()) t.addEventListener("ended", () => mine === token && mirrorCam.stop());
      await video.play().catch(() => undefined);
      if (mine !== token) return;
      set({ status: "on", video, error: null });
    } catch (err) {
      if (mine !== token) return;
      release();
      set({ status: "error", video: null, error: errorText(err) });
    }
  },
  stop(): void {
    token++;
    release();
    if (snapshot !== OFF) set(OFF);
  },
};
