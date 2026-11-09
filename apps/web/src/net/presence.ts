import { SNACKS, type ChatMessage, type DoorInfo, type EnterFailCode, type GameView, type Look, type Place, type PublicPlayer, type ServerMessage, type SnackId, type PresentationView, type PresentMode, type PresentRequest } from "@ghostel/shared";

export type ConnectionStatus = "connecting" | "online" | "reconnecting";

export interface PlayerView {
  id: string;
  name: string;
  look: Look;
  /** Latest server-accepted pose. Mutated in place by snapshots (no React re-render). */
  target: { x: number; z: number; ry: number };
  /** Diner snack held right now. */
  snack?: SnackId;
  /** Chair this player sits on. */
  seat?: { table: string; seat: number };
}

export type ChatLine = { kind: "chat"; id: string; msg: ChatMessage } | { kind: "notice"; id: string; text: string };

export interface Bubble {
  id: string;
  text: string;
}

export interface PresenceSnapshot {
  status: ConnectionStatus;
  selfId: string | null;
  players: readonly PlayerView[];
  chat: readonly ChatLine[];
  /** Speech bubbles keyed by public player ID. */
  bubbles: ReadonlyMap<string, Bubble>;
  /** Last server complaint about something we sent (e.g. chat rate limit). */
  notice: { id: number; text: string } | null;
  /** ID of the last history line received on (re)connect; older lines are never "unread". */
  historyMark: string | null;
  /** Lobby or the room we are in (null until the first welcome). */
  place: Place | null;
  /** Why the last room entry failed (cleared when an entry succeeds). */
  enterError: { seq: number; roomId: string; code: EnterFailCode; message: string } | null;
  /** Informational messages from the server, e.g. a room was closed. */
  info: { id: number; text: string } | null;
  /** The room's running game as the server lets us see it; `receivedAt` (performance.now) anchors its timer. */
  game: { view: GameView; receivedAt: number } | null;
  /** Candy ids this guest has found (server-confirmed). */
  candies: readonly string[];
  /** The room's presentation (screen share or slides), if any. */
  presentation: PresentationView | null;
  /** Owners only: guests asking to present. */
  presentRequests: readonly PresentRequest[];
  /** Room doors on the floor we are on (empty inside a room), kept live by the server. */
  doors: readonly DoorInfo[];
}

/** Call messages handled by CallClient (membership and WebRTC signaling). */
export type CallEvent = Extract<ServerMessage, { t: "call" | "signal" }>;

const MAX_CHAT_LINES = 100;
const BUBBLE_MS = 6000;
const NOTICE_MS = 4000;

type Listener = () => void;

/** WebSocket client for lobby presence. React subscribes to structural changes only. */
export class PresenceClient {
  private ws: WebSocket | null = null;
  private readonly players = new Map<string, PlayerView>();
  private listeners = new Set<Listener>();
  private snapshot: PresenceSnapshot = {
    status: "connecting",
    selfId: null,
    players: [],
    chat: [],
    bubbles: new Map(),
    notice: null,
    historyMark: null,
    place: null,
    enterError: null,
    info: null,
    game: null,
    candies: [],
    doors: [],
    presentation: null,
    presentRequests: [],
  };
  private enterSeq = 0;
  /** Scene epoch from the latest welcome, echoed in moves. */
  private epoch = 0;
  private pendingRoom: string | null = null;
  private lineSeq = 0;
  private noticeSeq = 0;
  private retry = 0;
  private retryTimer: number | null = null;
  private closed = false;

  /** Set by CallClient. Messages arriving before it exists are kept until it does. */
  callHandler: ((event: CallEvent) => void) | null = null;
  private lastCall: Extract<ServerMessage, { t: "call" }> | null = null;

  /** Called when the server moves our own character (welcome spawn or correction). */
  onSelfTeleport: ((x: number, z: number, ry: number | null) => void) | null = null;

  constructor(private readonly url: string = PresenceClient.defaultUrl()) {
    this.connect();
  }

  static defaultUrl(): string {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${location.host}/ws`;
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): PresenceSnapshot => this.snapshot;

  sendMove(x: number, z: number, ry: number): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: "move", x, z, ry, e: this.epoch }));
  }

  /** Returns false when not connected. The server echoes accepted messages back. */
  sendChat(text: string): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify({ t: "chat", text }));
    return true;
  }

  /** Ask to enter a room. The password is sent once and never stored. */
  sendEnter(roomId: string, password?: string): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.pendingRoom = roomId;
    this.ws.send(JSON.stringify(password ? { t: "enter", room: roomId, password } : { t: "enter", room: roomId }));
    return true;
  }

  sendCall(msg: { t: "media"; mic: boolean; cam: string | null; screen: string | null } | { t: "signal"; to: string; data: unknown }): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  sendPresent(
    msg:
      | { t: "present_request"; mode: PresentMode }
      | { t: "present_decide"; id: string; allow: boolean }
      | { t: "present_stop" }
      | { t: "present_page"; page: number; pages: number },
  ): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  sendSit(table: string, seat: number): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: "sit", table, seat }));
  }

  sendStand(): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: "stand" }));
  }

  /** The latest call message, for a CallClient created after it arrived. */
  latestCall(): Extract<ServerMessage, { t: "call" }> | null {
    return this.lastCall;
  }

  sendGame(msg: { t: "game_start" } | { t: "game_action"; action: unknown }): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  sendOrder(snack: SnackId): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: "order", snack }));
  }

  sendFloor(floor: number): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: "floor", floor }));
  }

  /** Ask the server to count a candy; it checks the floor and our position itself. */
  sendCollect(candy: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: "collect", candy }));
  }

  sendExit(): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: "exit" }));
  }

  close(): void {
    this.closed = true;
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.ws?.close();
  }

  private connect(): void {
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      try {
        this.handle(JSON.parse(event.data) as ServerMessage);
      } catch {
        // Ignore malformed frames.
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.players.clear();
      if (this.closed) return;
      this.publish({ status: "reconnecting", selfId: null });
      const delay = Math.min(10_000, 1000 * 2 ** this.retry++);
      this.retryTimer = window.setTimeout(() => this.connect(), delay);
    };
  }

  private handle(msg: ServerMessage): void {
    switch (msg.t) {
      case "welcome": {
        this.retry = 0;
        // A new scene (or a reconnect) leaves the old call; the server sends the new one right after.
        this.lastCall = null;
        this.callHandler?.({ t: "call", call: null });
        this.epoch = msg.epoch;
        this.players.clear();
        for (const p of msg.players) this.players.set(p.id, toView(p));
        const self = this.players.get(msg.selfId);
        if (self) this.onSelfTeleport?.(self.target.x, self.target.z, self.target.ry);
        const chat: ChatLine[] = msg.chat.map((m) => ({ kind: "chat", id: `c${m.id}`, msg: m }));
        this.publish({
          status: "online",
          selfId: msg.selfId,
          chat,
          bubbles: new Map(),
          historyMark: chat.at(-1)?.id ?? null,
          place: msg.place,
          enterError: null,
          game: msg.game ? { view: msg.game, receivedAt: performance.now() } : null,
          candies: msg.candies,
          doors: msg.doors,
          presentation: null,
          presentRequests: [],
        });
        break;
      }
      case "doors":
        this.publish({ doors: msg.doors });
        break;
      case "snack": {
        const p = this.players.get(msg.id);
        if (p) {
          const next: PlayerView = { ...p };
          if (msg.snack) next.snack = msg.snack;
          else delete next.snack;
          this.players.set(msg.id, next);
        }
        const item = msg.snack ? SNACKS.find((s) => s.id === msg.snack) : undefined;
        this.publish(
          item
            ? {
                chat: this.appendLine({
                  kind: "notice",
                  id: `n${++this.lineSeq}`,
                  text: msg.id === this.snapshot.selfId ? `${item.emoji} Order up! Enjoy your ${item.name}.` : `${item.emoji} ${msg.name} ordered ${item.name}`,
                }),
              }
            : {},
        );
        break;
      }
      case "join":
        this.players.set(msg.player.id, toView(msg.player));
        this.publish({ chat: this.appendLine({ kind: "notice", id: `n${++this.lineSeq}`, text: `${msg.player.name} arrived` }) });
        break;
      case "leave": {
        const gone = this.players.get(msg.id);
        if (!gone) break;
        this.players.delete(msg.id);
        const bubbles = new Map(this.snapshot.bubbles);
        bubbles.delete(msg.id);
        this.publish({ bubbles, chat: this.appendLine({ kind: "notice", id: `n${++this.lineSeq}`, text: `${gone.name} left` }) });
        break;
      }
      case "chat": {
        const bubble = { id: msg.msg.id, text: msg.msg.text };
        const bubbles = new Map(this.snapshot.bubbles).set(msg.msg.from, bubble);
        this.publish({ bubbles, chat: this.appendLine({ kind: "chat", id: `c${msg.msg.id}`, msg: msg.msg }) });
        window.setTimeout(() => {
          if (this.snapshot.bubbles.get(msg.msg.from) !== bubble) return;
          const next = new Map(this.snapshot.bubbles);
          next.delete(msg.msg.from);
          this.publish({ bubbles: next });
        }, BUBBLE_MS);
        break;
      }
      case "snap":
        for (const [id, x, z, ry] of msg.p) {
          const p = this.players.get(id);
          if (p) {
            p.target.x = x;
            p.target.z = z;
            p.target.ry = ry;
          }
        }
        break;
      case "profile": {
        const p = this.players.get(msg.id);
        if (p) {
          this.players.set(msg.id, { ...p, name: msg.name, look: msg.look });
          this.publish({});
        }
        break;
      }
      case "correct":
        this.onSelfTeleport?.(msg.x, msg.z, null);
        break;
      case "candies":
        this.publish({ candies: msg.found });
        break;
      case "candy_found":
        this.publish({
          chat: this.appendLine({
            kind: "notice",
            id: `n${++this.lineSeq}`,
            text: msg.id === this.snapshot.selfId ? "🍬 You found a candy!" : `🍬 ${msg.name} found a candy!`,
          }),
        });
        break;
      case "game":
        this.publish({ game: msg.view ? { view: msg.view, receivedAt: performance.now() } : null });
        break;
      case "game_denied": {
        const info = { id: ++this.noticeSeq, text: msg.message };
        this.publish({ info });
        window.setTimeout(() => {
          if (this.snapshot.info === info) this.publish({ info: null });
        }, 4000);
        break;
      }
      case "call":
        this.lastCall = msg;
        this.callHandler?.(msg);
        break;
      case "signal":
        this.callHandler?.(msg);
        break;
      case "seat": {
        const p = this.players.get(msg.id);
        if (p) {
          const next: PlayerView = { ...p };
          if (msg.table !== null && msg.seat !== null) next.seat = { table: msg.table, seat: msg.seat };
          else delete next.seat;
          this.players.set(msg.id, next);
          this.publish({});
        }
        break;
      }
      case "presentation":
        this.publish({ presentation: msg.p });
        break;
      case "present_requests":
        this.publish({ presentRequests: msg.requests });
        break;
      case "seat_denied": {
        const info = { id: ++this.noticeSeq, text: msg.message };
        this.publish({ info });
        window.setTimeout(() => {
          if (this.snapshot.info === info) this.publish({ info: null });
        }, 3500);
        break;
      }
      case "enter_failed":
        this.publish({
          enterError: { seq: ++this.enterSeq, roomId: this.pendingRoom ?? "", code: msg.code, message: msg.message },
        });
        break;
      case "room": {
        const place = this.snapshot.place;
        if (place?.kind === "room" && place.room.id === msg.room.id) this.publish({ place: { ...place, room: msg.room } });
        break;
      }
      case "notice": {
        const info = { id: ++this.noticeSeq, text: msg.message };
        this.publish({ info });
        window.setTimeout(() => {
          if (this.snapshot.info === info) this.publish({ info: null });
        }, 6000);
        break;
      }
      case "error": {
        const notice = { id: ++this.noticeSeq, text: msg.message };
        this.publish({ notice });
        window.setTimeout(() => {
          if (this.snapshot.notice === notice) this.publish({ notice: null });
        }, NOTICE_MS);
        break;
      }
    }
  }

  private appendLine(line: ChatLine): ChatLine[] {
    return [...this.snapshot.chat, line].slice(-MAX_CHAT_LINES);
  }

  private publish(patch: Partial<Omit<PresenceSnapshot, "players">>): void {
    this.snapshot = { ...this.snapshot, ...patch, players: [...this.players.values()] };
    for (const l of this.listeners) l();
  }
}

function toView(p: PublicPlayer): PlayerView {
  return {
    id: p.id,
    name: p.name,
    look: p.look,
    target: { x: p.x, z: p.z, ry: p.ry },
    ...(p.snack ? { snack: p.snack } : {}),
    ...(p.seat ? { seat: { ...p.seat } } : {}),
  };
}
