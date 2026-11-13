import { CAMERA_CONSTRAINTS, SCREEN_CONSTRAINTS, sceneKeyFor, type CallState, type IceServer, type VoiceSignalData } from "@ghostel/shared";
import type { CallEvent, PresenceClient } from "./presence";

/** What other members share, by member id. */
export interface RemoteMedia {
  cam: MediaStream | null;
  screen: MediaStream | null;
}

export interface CallSnapshot {
  /** The server's view of our call (room or table); null when we are in none. */
  call: CallState | null;
  /** What we share. */
  mic: boolean;
  cam: boolean;
  screen: boolean;
  /** A device is being opened (permission prompt may be showing). */
  starting: "mic" | "cam" | "screen" | null;
  error: string | null;
  /** Member ids currently speaking; "self" for us. */
  speaking: ReadonlySet<string>;
  remote: ReadonlyMap<string, RemoteMedia>;
  localCam: MediaStream | null;
  localScreen: MediaStream | null;
  /** Peers whose WebRTC connection is up. */
  connected: number;
}

interface Peer {
  id: string;
  pc: RTCPeerConnection;
  /** Perfect negotiation: the polite side rolls back on offer collisions. */
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  audio: HTMLAudioElement;
  /** Remote voice; analysed once our AudioContext is allowed to run. */
  audioStream: MediaStream | null;
  analyser: AnalyserNode | null;
  streams: Map<string, MediaStream>;
  senders: { mic: RTCRtpSender | null; cam: RTCRtpSender | null; screen: RTCRtpSender | null };
  connected: boolean;
}

const LEVEL_INTERVAL_MS = 120;
const SPEAKING_RMS = 0.02;
const HANGOVER_MS = 400;

const EMPTY: CallSnapshot = {
  call: null,
  mic: false,
  cam: false,
  screen: false,
  starting: null,
  error: null,
  speaking: new Set(),
  remote: new Map(),
  localCam: null,
  localScreen: null,
  connected: 0,
};

function mediaError(error: unknown, device: "Microphone" | "Camera" | "Screen sharing"): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError") return `${device} blocked. Allow it in the browser's site settings and try again.`;
  if (name === "NotFoundError") return `No ${device.toLowerCase()} found.`;
  return `Could not start the ${device.toLowerCase()}.`;
}

/**
 * Peer-to-peer WebRTC mesh for the call the server puts us in (a room, or a table we sit at).
 * Signaling goes through the presence WebSocket and the server only relays between call members.
 * Microphone, camera and screen start only from a click and stop when we leave the call.
 */
export class CallClient {
  private snapshot: CallSnapshot = EMPTY;
  private listeners = new Set<() => void>();
  private peers = new Map<string, Peer>();
  private micStream: MediaStream | null = null;
  private camStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private selfAnalyser: AnalyserNode | null = null;
  private iceServers: IceServer[] | null = null;
  private levelTimer: number | null = null;
  private lastLoud = new Map<string, number>();
  private buffer = new Uint8Array(1024);
  /** Signals are handled strictly in order so ICE never races its description. */
  private queue: Promise<void> = Promise.resolve();
  private callKey: string | null = null;
  /** The handler this client installed on the presence client, while attached. */
  private attached: ((event: CallEvent) => void) | null = null;

  constructor(private readonly presence: PresenceClient) {}

  /**
   * Starts receiving this guest's call messages (and replays the latest one). Called from an effect, so
   * React StrictMode's mount → unmount → mount in development leaves it attached (see `detach`).
   */
  attach(): void {
    const handler = (event: CallEvent) => {
      this.queue = this.queue.then(() => this.handle(event)).catch(() => undefined);
    };
    this.presence.callHandler = handler;
    this.attached = handler;
    const last = this.presence.latestCall();
    if (last) handler(last);
  }

  /** Stops receiving call messages and leaves the call (mic, camera, screen and peers stop). */
  detach(): void {
    if (this.attached && this.presence.callHandler === this.attached) this.presence.callHandler = null;
    this.attached = null;
    this.endCall();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  /** Call from a click (or key press): lets the AudioContext start so remote voices can be analysed. */
  prime(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        this.ctx = null;
      }
    }
    void this.ctx?.resume().catch(() => undefined);
  }

  async toggleMic(): Promise<void> {
    if (!this.snapshot.call) return;
    this.prime();
    const track = this.micStream?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      this.publish({ mic: track.enabled });
      this.sendMedia();
      return;
    }
    if (!this.mediaAvailable()) return;
    this.publish({ starting: "mic", error: null });
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    } catch (error) {
      this.publish({ starting: null, error: mediaError(error, "Microphone") });
      return;
    }
    if (!this.snapshot.call) return this.stopLocal();
    this.selfAnalyser = this.analyse(this.micStream);
    for (const peer of this.peers.values()) this.attachTracks(peer);
    this.publish({ starting: null, mic: true });
    this.sendMedia();
  }

  async toggleCam(): Promise<void> {
    if (!this.snapshot.call) return;
    this.prime();
    if (this.camStream) {
      this.stopStream("cam");
      this.publish({ cam: false, localCam: null });
      this.sendMedia();
      return;
    }
    if (!this.mediaAvailable()) return;
    this.publish({ starting: "cam", error: null });
    try {
      this.camStream = await navigator.mediaDevices.getUserMedia({ video: CAMERA_CONSTRAINTS, audio: false });
    } catch (error) {
      this.publish({ starting: null, error: mediaError(error, "Camera") });
      return;
    }
    if (!this.snapshot.call) return this.stopLocal();
    for (const peer of this.peers.values()) this.attachTracks(peer);
    this.publish({ starting: null, cam: true, localCam: this.camStream });
    this.sendMedia();
  }

  /** Screen sharing (approved presenters only; the server ignores it otherwise). Desktop browsers only. */
  async startScreen(): Promise<boolean> {
    if (!this.snapshot.call || this.screenStream) return false;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      this.publish({ error: "This browser cannot share its screen. Try a desktop browser, or present PDF slides." });
      return false;
    }
    this.publish({ starting: "screen", error: null });
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: SCREEN_CONSTRAINTS, audio: false });
    } catch (error) {
      this.publish({ starting: null, error: error instanceof DOMException && error.name === "NotAllowedError" ? null : mediaError(error, "Screen sharing") });
      return false;
    }
    if (!this.snapshot.call) {
      this.stopLocal();
      return false;
    }
    // The browser's own "Stop sharing" button ends it too.
    this.screenStream.getVideoTracks()[0]?.addEventListener("ended", () => this.stopScreen());
    for (const peer of this.peers.values()) this.attachTracks(peer);
    this.publish({ starting: null, screen: true, localScreen: this.screenStream });
    this.sendMedia();
    return true;
  }

  stopScreen(): void {
    if (!this.screenStream) return;
    this.stopStream("screen");
    this.publish({ screen: false, localScreen: null });
    this.sendMedia();
  }

  clearError(): void {
    this.publish({ error: null });
  }

  private mediaAvailable(): boolean {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.publish({ error: "Calls need a secure connection (HTTPS). Chat still works!" });
      return false;
    }
    return true;
  }

  private sendMedia(): void {
    const mic = this.micStream?.getAudioTracks()[0]?.enabled ?? false;
    this.presence.sendCall({ t: "media", mic, cam: this.camStream?.id ?? null, screen: this.screenStream?.id ?? null });
  }

  private async handle(event: CallEvent): Promise<void> {
    if (event.t === "call") return this.onCall(event.call);
    await this.onSignal(event.from, event.data);
  }

  private async onCall(call: CallState | null): Promise<void> {
    const selfId = this.presence.getSnapshot().selfId;
    const place = this.presence.getSnapshot().place;
    const key = call && place ? `${sceneKeyFor(place)}#${call.table ?? ""}` : null;
    if (!call || !selfId) {
      this.endCall();
      return;
    }
    if (this.callKey !== null && this.callKey !== key) this.endCall();
    this.callKey = key;
    if (this.iceServers === null) {
      this.iceServers = [];
      try {
        const res = await fetch("/api/voice", { credentials: "same-origin", cache: "no-store" });
        if (res.ok) this.iceServers = ((await res.json()) as { iceServers: IceServer[] }).iceServers;
      } catch {
        // Host candidates only; fine on one network.
      }
    }
    const others = new Set(call.members.filter((m) => m.id !== selfId).map((m) => m.id));
    for (const id of [...this.peers.keys()]) if (!others.has(id)) this.dropPeer(id);
    for (const id of others) if (!this.peers.has(id)) this.createPeer(id, selfId);
    if (this.levelTimer === null) this.levelTimer = window.setInterval(() => this.sampleLevels(), LEVEL_INTERVAL_MS);
    this.publish({ call, remote: this.remoteMedia(call) });
  }

  /** Leaves the call: closes every connection and releases the microphone, camera and screen. */
  private endCall(): void {
    for (const id of [...this.peers.keys()]) this.dropPeer(id);
    this.stopLocal();
    if (this.levelTimer !== null) window.clearInterval(this.levelTimer);
    this.levelTimer = null;
    this.lastLoud.clear();
    this.callKey = null;
    this.snapshot = { ...EMPTY, error: this.snapshot.error };
    for (const l of this.listeners) l();
  }

  private stopStream(which: "mic" | "cam" | "screen"): void {
    const stream = which === "mic" ? this.micStream : which === "cam" ? this.camStream : this.screenStream;
    if (!stream) return;
    for (const peer of this.peers.values()) {
      const sender = peer.senders[which];
      if (sender) {
        try {
          peer.pc.removeTrack(sender);
        } catch {
          // Connection already closed.
        }
        peer.senders[which] = null;
      }
    }
    for (const t of stream.getTracks()) t.stop();
    if (which === "mic") {
      this.micStream = null;
      this.selfAnalyser = null;
    } else if (which === "cam") this.camStream = null;
    else this.screenStream = null;
  }

  private stopLocal(): void {
    this.stopStream("mic");
    this.stopStream("cam");
    this.stopStream("screen");
    this.publish({ mic: false, cam: false, screen: false, starting: null, localCam: null, localScreen: null });
  }

  private send(to: string, data: VoiceSignalData): void {
    this.presence.sendCall({ t: "signal", to, data });
  }

  /** Adds whatever we share to a connection (negotiation follows automatically). */
  private attachTracks(peer: Peer): void {
    const add = (which: "mic" | "cam" | "screen", stream: MediaStream | null) => {
      const track = stream?.getTracks()[0];
      if (!stream || !track || peer.senders[which]) return;
      peer.senders[which] = peer.pc.addTrack(track, stream);
    };
    add("mic", this.micStream);
    add("cam", this.camStream);
    add("screen", this.screenStream);
  }

  private createPeer(id: string, selfId: string): Peer {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers ?? [] });
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.setAttribute("playsinline", "");
    audio.dataset["voicePeer"] = id;
    audio.hidden = true;
    document.body.append(audio);
    const peer: Peer = {
      id,
      pc,
      polite: selfId < id,
      makingOffer: false,
      ignoreOffer: false,
      audio,
      audioStream: null,
      analyser: null,
      streams: new Map(),
      senders: { mic: null, cam: null, screen: null },
      connected: false,
    };
    this.peers.set(id, peer);
    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        const d = pc.localDescription;
        if (d && (d.type === "offer" || d.type === "answer")) this.send(id, { kind: d.type, sdp: d.sdp });
      } catch {
        // Retried by the next negotiationneeded.
      } finally {
        peer.makingOffer = false;
      }
    };
    pc.onicecandidate = (e) => {
      if (e.candidate && e.candidate.candidate) {
        this.send(id, { kind: "ice", candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex });
      }
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      if (e.track.kind === "audio") {
        audio.srcObject = stream;
        void audio.play().catch(() => undefined);
        peer.audioStream = stream;
        peer.analyser = this.analyse(stream);
      } else {
        peer.streams.set(stream.id, stream);
        e.track.addEventListener("ended", () => peer.streams.delete(stream.id));
        stream.addEventListener("removetrack", () => {
          if (stream.getTracks().length === 0) {
            peer.streams.delete(stream.id);
            this.publish({ remote: this.remoteMedia(this.snapshot.call) });
          }
        });
      }
      this.publish({ remote: this.remoteMedia(this.snapshot.call) });
    };
    pc.onconnectionstatechange = () => {
      peer.connected = pc.connectionState === "connected";
      this.publish({ connected: [...this.peers.values()].filter((p) => p.connected).length });
    };
    this.attachTracks(peer);
    return peer;
  }

  private async onSignal(from: string, data: VoiceSignalData): Promise<void> {
    const selfId = this.presence.getSnapshot().selfId;
    if (!selfId || !this.snapshot.call?.members.some((m) => m.id === from)) return;
    const peer = this.peers.get(from) ?? this.createPeer(from, selfId);
    const pc = peer.pc;
    if (data.kind === "ice") {
      try {
        await pc.addIceCandidate({ candidate: data.candidate, sdpMid: data.sdpMid, sdpMLineIndex: data.sdpMLineIndex });
      } catch {
        // Candidates for an offer we ignored, or after close: harmless.
      }
      return;
    }
    const collision = data.kind === "offer" && (peer.makingOffer || pc.signalingState !== "stable");
    peer.ignoreOffer = !peer.polite && collision;
    if (peer.ignoreOffer) return;
    try {
      await pc.setRemoteDescription({ type: data.kind, sdp: data.sdp });
      if (data.kind === "offer") {
        await pc.setLocalDescription();
        const d = pc.localDescription;
        if (d && (d.type === "offer" || d.type === "answer")) this.send(from, { kind: d.type, sdp: d.sdp });
      }
    } catch {
      // A stale answer after a rollback; the next negotiation fixes it.
    }
  }

  private dropPeer(id: string): void {
    const peer = this.peers.get(id);
    if (!peer) return;
    peer.pc.close();
    peer.audio.srcObject = null;
    peer.audio.remove();
    this.peers.delete(id);
    this.lastLoud.delete(id);
    this.publish({ connected: [...this.peers.values()].filter((p) => p.connected).length, remote: this.remoteMedia(this.snapshot.call) });
  }

  /** Matches the stream ids members announce (camera, screen) with the streams we received. */
  private remoteMedia(call: CallState | null): Map<string, RemoteMedia> {
    const out = new Map<string, RemoteMedia>();
    if (!call) return out;
    for (const m of call.members) {
      const peer = this.peers.get(m.id);
      if (!peer) continue;
      const live = (sid: string | null) => {
        const s = sid ? peer.streams.get(sid) : undefined;
        return s && s.getVideoTracks().some((t) => t.readyState === "live") ? s : null;
      };
      out.set(m.id, { cam: live(m.cam), screen: live(m.screen) });
    }
    return out;
  }

  private analyse(stream: MediaStream): AnalyserNode | null {
    if (!this.ctx || this.ctx.state !== "running") return null;
    try {
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 1024;
      this.ctx.createMediaStreamSource(stream).connect(analyser);
      return analyser;
    } catch {
      return null;
    }
  }

  private rms(analyser: AnalyserNode): number {
    analyser.getByteTimeDomainData(this.buffer);
    let sum = 0;
    for (const v of this.buffer) {
      const x = (v - 128) / 128;
      sum += x * x;
    }
    return Math.sqrt(sum / this.buffer.length);
  }

  private sampleLevels(): void {
    const now = performance.now();
    const loud = (key: string, analyser: AnalyserNode | null) => {
      if (analyser && this.rms(analyser) > SPEAKING_RMS) this.lastLoud.set(key, now);
    };
    if (this.snapshot.mic) loud("self", this.selfAnalyser);
    const call = this.snapshot.call;
    for (const [id, peer] of this.peers) {
      if (!peer.analyser && peer.audioStream) peer.analyser = this.analyse(peer.audioStream);
      if (call?.members.find((m) => m.id === id)?.mic) loud(id, peer.analyser);
    }
    const speaking = new Set<string>();
    for (const [key, at] of this.lastLoud) if (now - at < HANGOVER_MS) speaking.add(key);
    if (!this.snapshot.mic) speaking.delete("self");
    const prev = this.snapshot.speaking;
    if (speaking.size !== prev.size || [...speaking].some((k) => !prev.has(k))) this.publish({ speaking });
  }

  private publish(patch: Partial<CallSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.listeners) l();
  }
}
