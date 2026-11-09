import { randomBytes } from "node:crypto";
import {
  CANDIES,
  CANDY_SERVER_REACH,
  COUNTER_SERVER_REACH,
  COUNTER_SPOT,
  ORDER_COOLDOWN_MS,
  SNACK_MS,
  isSnackId,
  type SnackId,
  CHAT_BURST,
  ELEVATORS,
  crownUnlocked,
  floorOfPlace,
  isCandyId,
  layoutForPlace,
  sceneKeyFor,
  CHAT_HISTORY,
  CHAT_REFILL_SECONDS,
  CloseCode,
  doorArrival,
  doorsOnFloor,
  findDoor,
  type DoorInfo,
  LOBBY_LAYOUT,
  SEAT_REACH,
  constrainToWorld,
  findSeat,
  seatCode,
  standSpot,
  SLIDES_MAX_BYTES,
  type CallMember,
  type CallState,
  type PresentMode,
  type PresentRequest,
  type PresentationView,
  createGameRegistry,
  initialMoveState,
  normalizeAngle,
  parseClientMessage,
  resolveMove,
  validateChat,
  type AnyGameEngine,
  type ChatMessage,
  type GameRegistry,
  type GameView,
  type EnterFailCode,
  type Layout,
  type MoveState,
  type Place,
  type Profile,
  type PublicPlayer,
  type PublicRoom,
  type ServerMessage,
  type SnapshotRow,
  type Vec2,
  type VoiceSignalData,
} from "@ghostel/shared";
import type { RawData, WebSocket } from "ws";

export interface HubOptions {
  snapshotHz: number;
  maxConnectionsPerGuest: number;
  maxConnections: number;
  /** Token bucket for inbound messages per connection. */
  messagesPerSecond: number;
  messageBurst: number;
  /** Invalid frames tolerated before the socket is closed. */
  maxInvalidMessages: number;
  heartbeatMs: number;
  /** Chat token bucket per guest (shared by all of that guest's tabs). */
  chatBurst: number;
  chatRefillSeconds: number;
  /** Wall clock for chat timestamps. */
  clock: () => number;
  /** Disconnect clients whose send buffer grows beyond this (slow consumers). */
  maxBufferedBytes: number;
  now: () => number;
}

export const DEFAULT_HUB_OPTIONS: HubOptions = {
  snapshotHz: 15,
  maxConnectionsPerGuest: 3,
  maxConnections: 300,
  messagesPerSecond: 40,
  messageBurst: 60,
  maxInvalidMessages: 20,
  heartbeatMs: 15_000,
  chatBurst: CHAT_BURST,
  chatRefillSeconds: CHAT_REFILL_SECONDS,
  clock: () => Date.now(),
  maxBufferedBytes: 1_000_000,
  now: () => performance.now(),
};

export type GateResult = { ok: true; room: PublicRoom; owner: boolean } | { ok: false; code: EnterFailCode; message: string };

/** Decides whether a guest may enter a room. Implemented with the database and password hashes in app.ts. */
export interface RoomGate {
  check(input: { guestId: string; roomId: string; password: string | undefined; occupants: number }): Promise<GateResult>;
}

/** Persists found candies. Implemented with PostgreSQL in app.ts. */
export interface CandyStore {
  add(guestId: string, candy: string): Promise<string[]>;
}

const NO_CANDY_STORE: CandyStore = { add: async () => [] };

const NO_ROOMS: RoomGate = {
  check: async () => ({ ok: false, code: "not_found", message: "That room no longer exists." }),
};

const LOBBY = "lobby";
const NO_MEDIA = { mic: false, cam: null, screen: null } as const;
const roomChannel = (roomId: string) => `room:${roomId}`;
/** Channel names match scene keys: "lobby", "floor:2", "room:<id>". */
const channelOf = (place: Place) => sceneKeyFor(place);

interface Connection {
  ws: WebSocket;
  publicId: string;
  guestId: string;
  profile: Profile;
  /** Presence, movement and chat are only shared inside one channel. */
  channel: string;
  place: Place;
  layout: Layout;
  move: MoveState;
  ry: number;
  lastMoveAt: number;
  dirty: boolean;
  tokens: number;
  tokensAt: number;
  invalid: number;
  alive: boolean;
  entering: boolean;
  /** Chair this connection sits on (in its current channel). */
  seat: { table: string; seat: number } | null;
  /** Call this connection belongs to: "room:<id>" or "<channel>#<table>"; null when in none. */
  callKey: string | null;
  /** What it shares in that call. Reset when it leaves the call. */
  media: { mic: boolean; cam: string | null; screen: string | null };
  /** Scene epoch: bumps on every scene change so in-flight moves from the old scene are ignored. */
  epoch: number;
  /** Diner snack held until `until` (opts.now() time). Travels with the guest across scenes. */
  snack: { id: SnackId; until: number } | null;
  lastOrderAt: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

interface Presentation {
  presenter: Connection;
  mode: PresentMode;
  page: number;
  pages: number | null;
  /** PDF slides in memory only; deleted with the presentation. */
  file: { token: string; data: Buffer } | null;
}

export type SlidesUpload = { ok: true } | { ok: false; status: 403 | 404 | 415; error: string; message: string };

export type AdmitResult = { ok: true } | { ok: false; status: 429 | 503; reason: string };

/** In-memory presence for the lobby and every room. The only writer of positions other clients see. */
export class PresenceHub {
  private readonly conns = new Map<WebSocket, Connection>();
  private tickTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private readonly opts: HubOptions;
  private readonly chatBuckets = new Map<string, { tokens: number; at: number }>();
  private readonly histories = new Map<string, ChatMessage[]>();
  private chatSeq = 0;
  /** At most one running game per room channel. State is opaque here; only its engine reads it. */
  private readonly games = new Map<string, { engine: AnyGameEngine; state: unknown }>();
  private gameTimer: NodeJS.Timeout | null = null;
  /** Every room by id, kept in sync by the room routes; used for door labels. */
  private readonly rooms = new Map<string, PublicRoom>();
  /** One presentation per room channel. */
  private readonly presentations = new Map<string, Presentation>();
  /** Guests asking to present, per room channel. */
  private readonly presentRequests = new Map<string, Map<Connection, PresentMode>>();
  /** Occupied chairs per channel: seat code ("t3:1") → connection. */
  private readonly seats = new Map<string, Map<string, Connection>>();
  /** Found candies per guest (shared by all their tabs), loaded on connect. */
  private readonly candies = new Map<string, string[]>();
  private readonly collecting = new Set<string>();

  constructor(
    options: Partial<HubOptions> = {},
    private readonly gate: RoomGate = NO_ROOMS,
    private readonly registry: GameRegistry = createGameRegistry(),
    private readonly candyStore: CandyStore = NO_CANDY_STORE,
  ) {
    this.opts = { ...DEFAULT_HUB_OPTIONS, ...options };
  }

  start(): void {
    this.tickTimer ??= setInterval(() => this.tick(), 1000 / this.opts.snapshotHz);
    this.heartbeatTimer ??= setInterval(() => this.heartbeat(), this.opts.heartbeatMs);
    this.gameTimer ??= setInterval(() => this.tickGames(), 200);
  }

  stop(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.gameTimer) clearInterval(this.gameTimer);
    this.tickTimer = null;
    this.heartbeatTimer = null;
    this.gameTimer = null;
    this.games.clear();
    this.presentations.clear();
    this.presentRequests.clear();
    for (const c of this.conns.values()) c.ws.terminate();
    this.conns.clear();
  }

  get size(): number {
    return this.conns.size;
  }

  /** Loads the room list at startup. */
  setRooms(rooms: readonly PublicRoom[]): void {
    this.rooms.clear();
    for (const r of rooms) this.rooms.set(r.id, r);
  }

  roomCreated(room: PublicRoom): void {
    this.rooms.set(room.id, room);
    this.broadcastDoors(room.floor);
  }

  /** Ids of rooms with someone inside (never released by the stale-room cleanup). */
  occupiedRoomIds(): string[] {
    return [...this.rooms.keys()].filter((id) => this.occupancy(id) > 0);
  }

  doorsFor(floor: number): DoorInfo[] {
    const byCode = new Map([...this.rooms.values()].map((r) => [`${r.floor}${r.slot}`, r]));
    return doorsOnFloor(floor).map((d) => {
      const room = byCode.get(d.code) ?? null;
      return { code: d.code, floor: d.floor, slot: d.slot, room, occupants: room ? this.occupancy(room.id) : 0 };
    });
  }

  private broadcastDoors(floor: number): void {
    const channel = floor === 1 ? LOBBY : `floor:${floor}`;
    this.broadcast(channel, { t: "doors", doors: this.doorsFor(floor) });
  }

  /** Number of connections inside a room right now. */
  occupancy(roomId: string): number {
    return this.members(roomChannel(roomId)).length;
  }

  /** Checked before the HTTP upgrade completes. */
  canAdmit(guestId: string): AdmitResult {
    if (this.conns.size >= this.opts.maxConnections) return { ok: false, status: 503, reason: "hotel_full" };
    let mine = 0;
    for (const c of this.conns.values()) if (c.guestId === guestId) mine++;
    if (mine >= this.opts.maxConnectionsPerGuest) return { ok: false, status: 429, reason: "too_many_tabs" };
    return { ok: true };
  }

  attach(ws: WebSocket, guestId: string, profile: Profile, candies: string[] = []): void {
    if (!this.candies.has(guestId)) this.candies.set(guestId, candies);
    const now = this.opts.now();
    const conn: Connection = {
      ws,
      publicId: randomBytes(9).toString("base64url"),
      guestId,
      profile,
      channel: LOBBY,
      place: { kind: "lobby" },
      layout: LOBBY_LAYOUT,
      move: initialMoveState(LOBBY_LAYOUT.spawn()),
      ry: Math.PI,
      lastMoveAt: now,
      dirty: false,
      tokens: this.opts.messageBurst,
      tokensAt: now,
      invalid: 0,
      alive: true,
      entering: false,
      seat: null,
      callKey: null,
      media: { ...NO_MEDIA },
      epoch: 0,
      snack: null,
      lastOrderAt: -Infinity,
    };
    this.conns.set(ws, conn);

    ws.on("message", (data, isBinary) => this.onMessage(conn, data, isBinary));
    ws.on("pong", () => {
      conn.alive = true;
    });
    ws.on("close", () => this.detach(conn));
    ws.on("error", () => ws.terminate());

    this.welcome(conn);
  }

  /** Pushes a saved profile to every open tab of that guest and to everyone in the same channel. */
  updateProfile(guestId: string, profile: Profile): void {
    for (const c of this.conns.values()) {
      if (c.guestId !== guestId) continue;
      c.profile = profile;
      this.broadcast(c.channel, { t: "profile", id: c.publicId, name: profile.name, look: profile.look });
      if (c.callKey) this.sendCall(c.callKey);
    }
  }

  /** Room settings changed: tell everyone inside. Access changes never evict guests already inside. */
  updateRoom(room: PublicRoom): void {
    this.rooms.set(room.id, room);
    this.broadcastDoors(room.floor);
    for (const c of this.members(roomChannel(room.id))) {
      if (c.place.kind === "room") c.place = { ...c.place, room };
      this.send(c, { t: "room", room });
    }
  }

  /** Room deleted: everyone inside steps back out through its door, and the door shows "Vacant". */
  closeRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    for (const c of this.members(roomChannel(roomId))) {
      this.leaveRoom(c);
      this.send(c, { t: "notice", message: "The owner closed this room. Back to the hall!" });
    }
    this.rooms.delete(roomId);
    if (room) this.broadcastDoors(room.floor);
  }

  /** Out of a room, onto its floor, standing in front of its door. */
  private leaveRoom(conn: Connection): void {
    if (conn.place.kind !== "room") return;
    const { floor, slot } = conn.place.room;
    const door = findDoor(floor, slot);
    const place: Place = floor === 1 ? { kind: "lobby" } : { kind: "floor", floor };
    this.moveTo(conn, place, door ? doorArrival(door) : undefined);
  }

  private members(channel: string): Connection[] {
    return [...this.conns.values()].filter((c) => c.channel === channel);
  }

  private welcome(conn: Connection): void {
    const players = this.members(conn.channel).map((c) => this.toPublic(c));
    const chat = [...(this.histories.get(conn.channel) ?? [])];
    const game = this.gameView(conn);
    const candies = [...(this.candies.get(conn.guestId) ?? [])];
    const floor = floorOfPlace(conn.place);
    const doors = floor === null ? [] : this.doorsFor(floor);
    this.send(conn, { t: "welcome", selfId: conn.publicId, epoch: conn.epoch, place: conn.place, players, chat, game, candies, doors });
    this.broadcast(conn.channel, { t: "join", player: this.toPublic(conn) }, conn);
  }

  private leaveChannel(conn: Connection): void {
    const channel = conn.channel;
    this.leavePresentations(conn, channel);
    this.broadcast(channel, { t: "leave", id: conn.publicId }, conn);
    const game = this.games.get(channel);
    if (game) {
      game.state = game.engine.removePlayer(game.state, conn.publicId);
      if (game.engine.presentHumans(game.state) === 0) {
        this.games.delete(channel);
        this.broadcast(channel, { t: "game", view: null }, conn);
      } else {
        this.sendGame(channel, conn);
      }
    }
    // Room chat lives only while someone is inside.
    if (channel !== LOBBY && !this.members(channel).some((c) => c !== conn)) this.histories.delete(channel);
  }

  /** `arrive` overrides the layout's spawn (e.g. stepping out of the elevator). */
  private moveTo(conn: Connection, place: Place, arrive?: Vec2): void {
    const leftRoom = conn.place.kind === "room" ? conn.place.room.floor : null;
    this.freeSeat(conn);
    this.leaveChannel(conn);
    conn.place = place;
    conn.channel = channelOf(place);
    conn.layout = layoutForPlace(place);
    conn.move = initialMoveState(arrive ?? conn.layout.spawn());
    conn.epoch += 1;
    // Door labels show how many guests are inside: refresh them on both ends of the move.
    if (leftRoom !== null) this.broadcastDoorsAfter(leftRoom, conn);
    if (place.kind === "room") this.broadcastDoorsAfter(place.room.floor, conn);
    conn.ry = Math.PI;
    conn.lastMoveAt = this.opts.now();
    conn.dirty = false;
    this.welcome(conn);
    // Rooms are one call for everyone inside; floors have no call until you sit at a table.
    this.syncCall(conn);
    if (place.kind === "room") {
      this.send(conn, { t: "presentation", p: this.presentationView(conn.channel) });
      if (place.owner) this.sendRequests(conn.channel);
    }
  }

  private detach(conn: Connection): void {
    if (!this.conns.has(conn.ws)) return;
    this.freeSeat(conn);
    this.leaveChannel(conn);
    this.conns.delete(conn.ws);
    this.syncCall(conn, true);
    if (conn.place.kind === "room") this.broadcastDoors(conn.place.room.floor);
    // Keep the chat bucket while another tab of the same guest is open, so closing a tab cannot reset it.
    if (![...this.conns.values()].some((c) => c.guestId === conn.guestId)) {
      this.chatBuckets.delete(conn.guestId);
      this.candies.delete(conn.guestId);
    }
  }

  private takeToken(conn: Connection): boolean {
    const now = this.opts.now();
    const refill = ((now - conn.tokensAt) / 1000) * this.opts.messagesPerSecond;
    conn.tokens = Math.min(this.opts.messageBurst, conn.tokens + refill);
    conn.tokensAt = now;
    if (conn.tokens < 1) return false;
    conn.tokens -= 1;
    return true;
  }

  private rejectInvalid(conn: Connection): void {
    conn.invalid += 1;
    if (conn.invalid >= this.opts.maxInvalidMessages) conn.ws.close(CloseCode.TooManyInvalid, "too many invalid messages");
  }

  private onMessage(conn: Connection, data: RawData, isBinary: boolean): void {
    if (!this.takeToken(conn)) return; // silently drop floods
    if (isBinary) return this.rejectInvalid(conn);
    const parsed = parseClientMessage(data.toString());
    if (!parsed.ok) return this.rejectInvalid(conn);
    const msg = parsed.msg;
    switch (msg.t) {
      case "move": {
        if (msg.e !== undefined && msg.e !== conn.epoch) return; // sent before the last scene change
        if (conn.seat) return; // seated guests stay on their chair until they stand up
        const now = this.opts.now();
        const result = resolveMove(conn.move, { x: msg.x, z: msg.z }, (now - conn.lastMoveAt) / 1000, conn.layout);
        conn.move = { pos: result.pos, budget: result.budget };
        conn.ry = normalizeAngle(msg.ry);
        conn.lastMoveAt = now;
        conn.dirty = true;
        if (result.corrected) this.send(conn, { t: "correct", x: round2(result.pos.x), z: round2(result.pos.z) });
        break;
      }
      case "chat":
        this.onChat(conn, msg.text);
        break;
      case "enter":
        void this.onEnter(conn, msg.room, msg.password);
        break;
      case "exit":
        if (conn.place.kind === "room" && !conn.entering) this.leaveRoom(conn);
        break;
      case "sit":
        this.sit(conn, msg.table, msg.seat);
        break;
      case "stand":
        this.stand(conn);
        break;
      case "media":
        this.setMedia(conn, msg.mic, msg.cam, msg.screen);
        break;
      case "signal":
        this.relaySignal(conn, msg.to, msg.data);
        break;
      case "present_request":
        this.presentRequest(conn, msg.mode);
        break;
      case "present_decide":
        this.presentDecide(conn, msg.id, msg.allow);
        break;
      case "present_stop":
        this.presentStop(conn);
        break;
      case "present_page":
        this.presentPage(conn, msg.page, msg.pages);
        break;
      case "floor":
        this.takeElevator(conn, msg.floor);
        break;
      case "collect":
        void this.collect(conn, msg.candy);
        break;
      case "order":
        this.order(conn, msg.snack);
        break;
      case "game_start":
        this.startGame(conn);
        break;
      case "game_action":
        this.gameAction(conn, msg.action);
        break;
    }
  }

  /** Sends door labels once the moving connection has switched channel (so counts are right). */
  private broadcastDoorsAfter(floor: number, _conn: Connection): void {
    queueMicrotask(() => this.broadcastDoors(floor));
  }

  /** Elevators run between the lobby and floors 2–4. Rooms are left through their own exit. */
  private takeElevator(conn: Connection, floor: number): void {
    if (conn.entering || conn.place.kind === "room") return;
    if (floor !== 1 && floor !== 2 && floor !== 3 && floor !== 4 && floor !== 5) return;
    if (floorOfPlace(conn.place) === floor) return;
    const place: Place = floor === 1 ? { kind: "lobby" } : { kind: "floor", floor };
    this.moveTo(conn, place, ELEVATORS[floor].arrive());
  }

  /** Diner orders: floor 4, at the counter by the server's position, a menu item, not too often. */
  private order(conn: Connection, snack: string): void {
    if (!isSnackId(snack)) return this.rejectInvalid(conn);
    if (conn.place.kind !== "floor" || conn.place.floor !== 4) return;
    if (Math.hypot(conn.move.pos.x - COUNTER_SPOT.x, conn.move.pos.z - COUNTER_SPOT.z) > COUNTER_SERVER_REACH) return;
    const now = this.opts.now();
    if (now - conn.lastOrderAt < ORDER_COOLDOWN_MS) return;
    conn.lastOrderAt = now;
    conn.snack = { id: snack, until: now + SNACK_MS };
    this.broadcast(conn.channel, { t: "snack", id: conn.publicId, name: conn.profile.name, snack });
  }

  private expireSnacks(): void {
    const now = this.opts.now();
    for (const c of this.conns.values()) {
      if (c.snack && c.snack.until <= now) {
        c.snack = null;
        this.broadcast(c.channel, { t: "snack", id: c.publicId, name: c.profile.name, snack: null });
      }
    }
  }

  /** A candy only counts on its own floor, within reach of the server's position for this guest. */
  private async collect(conn: Connection, candyId: string): Promise<void> {
    if (!isCandyId(candyId)) return this.rejectInvalid(conn);
    const candy = CANDIES.find((c) => c.id === candyId);
    const found = this.candies.get(conn.guestId) ?? [];
    if (!candy || found.includes(candyId)) return;
    if (floorOfPlace(conn.place) !== candy.floor) return;
    if (Math.hypot(conn.move.pos.x - candy.x, conn.move.pos.z - candy.z) > CANDY_SERVER_REACH) return;
    const key = `${conn.guestId}:${candyId}`;
    if (this.collecting.has(key)) return;
    this.collecting.add(key);
    try {
      const wasUnlocked = crownUnlocked(found);
      const updated = await this.candyStore.add(conn.guestId, candyId);
      this.candies.set(conn.guestId, updated);
      for (const c of this.conns.values()) if (c.guestId === conn.guestId) this.send(c, { t: "candies", found: [...updated] });
      if (this.conns.has(conn.ws)) this.broadcast(conn.channel, { t: "candy_found", id: conn.publicId, name: conn.profile.name });
      if (!wasUnlocked && crownUnlocked(updated)) {
        for (const c of this.conns.values()) {
          if (c.guestId === conn.guestId) {
            this.send(c, { t: "notice", message: "👑 You found every candy! The Golden Crown is unlocked in Edit costume." });
          }
        }
      }
    } catch {
      // Storage failed: nothing changes, the guest can try again.
    } finally {
      this.collecting.delete(key);
    }
  }

  private gameView(conn: Connection): GameView | null {
    const game = this.games.get(conn.channel);
    return game ? game.engine.view(game.state, conn.publicId, this.opts.clock()) : null;
  }

  /** Each connection gets its own view (e.g. only you see your pick before the reveal). */
  private sendGame(channel: string, except?: Connection): void {
    const game = this.games.get(channel);
    const now = this.opts.clock();
    for (const c of this.members(channel)) {
      if (c === except) continue;
      this.send(c, { t: "game", view: game ? game.engine.view(game.state, c.publicId, now) : null });
    }
  }

  private startGame(conn: Connection): void {
    if (conn.place.kind !== "room") return this.send(conn, { t: "game_denied", message: "Games are played at a room's table." });
    const kind = conn.place.room.game;
    const engine = kind === "none" ? undefined : this.registry[kind];
    if (!engine) return this.send(conn, { t: "game_denied", message: "This room is just for hanging out." });
    if (this.games.has(conn.channel)) return this.send(conn, { t: "game_denied", message: "A game is already running." });
    const players = this.members(conn.channel)
      .slice(0, engine.maxPlayers)
      .map((c) => ({ id: c.publicId, name: c.profile.name }));
    const state = engine.create({ players, now: this.opts.clock(), rng: Math.random });
    this.games.set(conn.channel, { engine, state });
    this.sendGame(conn.channel);
  }

  private gameAction(conn: Connection, raw: unknown): void {
    const game = this.games.get(conn.channel);
    if (!game) return;
    const action = game.engine.parseAction(raw);
    if (action === null) return this.rejectInvalid(conn);
    const now = this.opts.clock();
    const next = game.engine.act(game.state, conn.publicId, action, now);
    if (next === null) return; // allowed shape, but not now (already answered, wrong round, spectator…)
    // Advance right away so "everyone answered" closes the question without waiting for the timer.
    game.state = game.engine.advance(next, now, Math.random);
    this.sendGame(conn.channel);
  }

  private tickGames(): void {
    this.expireSnacks();
    const now = this.opts.clock();
    for (const [channel, game] of this.games) {
      const next = game.engine.advance(game.state, now, Math.random);
      if (game.engine.done(next)) {
        this.games.delete(channel);
        this.sendGame(channel);
      } else if (next !== game.state) {
        game.state = next;
        this.sendGame(channel);
      }
    }
  }

  // ---- seats ----

  private seatsIn(channel: string): Map<string, Connection> {
    let m = this.seats.get(channel);
    if (!m) {
      m = new Map();
      this.seats.set(channel, m);
    }
    return m;
  }

  /** A free chair at a table in this scene, within reach of the server's position for the guest. */
  private sit(conn: Connection, table: string, seat: number): void {
    if (conn.entering) return;
    const found = findSeat(conn.place, table, seat);
    if (!found) return this.rejectInvalid(conn);
    if (conn.seat?.table === table && conn.seat.seat === seat) return;
    if (Math.hypot(conn.move.pos.x - found.seat.x, conn.move.pos.z - found.seat.z) > SEAT_REACH) {
      return this.send(conn, { t: "seat_denied", message: "Walk up to the chair first." });
    }
    const taken = this.seatsIn(conn.channel);
    const code = seatCode(table, seat);
    const holder = taken.get(code);
    if (holder && holder !== conn) return this.send(conn, { t: "seat_denied", message: "Someone is already sitting there." });
    this.freeSeat(conn, false);
    taken.set(code, conn);
    conn.seat = { table, seat };
    conn.move = initialMoveState({ x: found.seat.x, z: found.seat.z });
    conn.ry = found.seat.ry;
    conn.lastMoveAt = this.opts.now();
    conn.dirty = true;
    this.broadcast(conn.channel, { t: "seat", id: conn.publicId, table, seat });
    this.syncCall(conn);
  }

  /** Back on your feet, just outside your chair. */
  private stand(conn: Connection): void {
    if (!conn.seat) return;
    const found = findSeat(conn.place, conn.seat.table, conn.seat.seat);
    this.freeSeat(conn);
    if (found) {
      const spot = constrainToWorld(standSpot(found.table, found.seat), conn.layout);
      conn.move = initialMoveState(spot);
      conn.lastMoveAt = this.opts.now();
      conn.dirty = true;
      this.send(conn, { t: "correct", x: round2(spot.x), z: round2(spot.z) });
    }
    this.syncCall(conn);
  }

  /** Frees the chair (if any). `announce` false when the caller announces a new seat right away. */
  private freeSeat(conn: Connection, announce = true): void {
    if (!conn.seat) return;
    const taken = this.seats.get(conn.channel);
    const code = seatCode(conn.seat.table, conn.seat.seat);
    if (taken?.get(code) === conn) taken.delete(code);
    if (taken?.size === 0) this.seats.delete(conn.channel);
    conn.seat = null;
    if (announce) this.broadcast(conn.channel, { t: "seat", id: conn.publicId, table: null, seat: null });
  }

  // ---- calls ----

  private callKeyFor(conn: Connection): string | null {
    if (conn.place.kind === "room") return conn.channel;
    return conn.seat ? `${conn.channel}#${conn.seat.table}` : null;
  }

  private callMembers(key: string): Connection[] {
    return [...this.conns.values()].filter((c) => c.callKey === key);
  }

  private callState(key: string): CallState {
    const table = key.includes("#") ? (key.split("#")[1] as string) : null;
    const members: CallMember[] = this.callMembers(key).map((c) => ({
      id: c.publicId,
      name: c.profile.name,
      mic: c.media.mic,
      cam: c.media.cam,
      screen: c.media.screen,
      seat: c.seat?.seat ?? null,
    }));
    return { kind: table === null ? "room" : "table", table, members };
  }

  private sendCall(key: string): void {
    const state = this.callState(key);
    const payload = JSON.stringify({ t: "call", call: state } satisfies ServerMessage);
    for (const c of this.callMembers(key)) this.sendRaw(c, payload);
  }

  /** Moves a connection into the call its place and seat imply, telling both calls. `gone` = disconnected. */
  private syncCall(conn: Connection, gone = false): void {
    const next = gone ? null : this.callKeyFor(conn);
    const prev = conn.callKey;
    if (prev === next) {
      // Same call, but the seat may have changed: refresh it for everyone.
      if (next) this.sendCall(next);
      return;
    }
    conn.callKey = next;
    conn.media = { ...NO_MEDIA };
    if (prev) this.sendCall(prev);
    if (next) this.sendCall(next);
    else if (!gone) this.send(conn, { t: "call", call: null });
  }

  /** Mic on/off and stream ids. Screen sharing only for the room's approved presenter. */
  private setMedia(conn: Connection, mic: boolean, cam: string | null, screen: string | null): void {
    if (!conn.callKey) return;
    const allowedScreen = screen !== null && this.mayShareScreen(conn) ? screen : null;
    const m = conn.media;
    if (m.mic === mic && m.cam === cam && m.screen === allowedScreen) return;
    conn.media = { mic, cam, screen: allowedScreen };
    this.sendCall(conn.callKey);
  }

  /** Only the approved presenter of a screen-share presentation may share a screen. */
  private mayShareScreen(conn: Connection): boolean {
    const p = this.presentations.get(conn.channel);
    return p !== undefined && p.presenter === conn && p.mode === "screen";
  }

  // ---- presentations ----

  private presentationView(channel: string): PresentationView | null {
    const p = this.presentations.get(channel);
    if (!p) return null;
    return { presenter: p.presenter.publicId, name: p.presenter.profile.name, mode: p.mode, page: p.page, pages: p.pages, file: p.file?.token ?? null };
  }

  private broadcastPresentation(channel: string): void {
    this.broadcast(channel, { t: "presentation", p: this.presentationView(channel) });
  }

  private isOwner(conn: Connection): boolean {
    return conn.place.kind === "room" && conn.place.owner;
  }

  private sendRequests(channel: string): void {
    const requests: PresentRequest[] = [...(this.presentRequests.get(channel) ?? new Map<Connection, PresentMode>()).entries()].map(([c, mode]) => ({
      id: c.publicId,
      name: c.profile.name,
      mode,
    }));
    for (const c of this.members(channel)) if (this.isOwner(c)) this.send(c, { t: "present_requests", requests });
  }

  private presentRequest(conn: Connection, mode: PresentMode): void {
    if (conn.place.kind !== "room") return this.send(conn, { t: "notice", message: "Presentations happen in rooms." });
    const current = this.presentations.get(conn.channel);
    if (current) {
      if (current.presenter !== conn) this.send(conn, { t: "notice", message: `${current.presenter.profile.name} is presenting right now.` });
      return;
    }
    if (this.isOwner(conn)) return this.startPresentation(conn, mode);
    let requests = this.presentRequests.get(conn.channel);
    if (!requests) {
      requests = new Map();
      this.presentRequests.set(conn.channel, requests);
    }
    requests.set(conn, mode);
    this.send(conn, { t: "notice", message: "Asked the room's owner to let you present. Wait for a yes!" });
    this.sendRequests(conn.channel);
  }

  private presentDecide(conn: Connection, id: string, allow: boolean): void {
    if (!this.isOwner(conn)) return this.rejectInvalid(conn);
    const requests = this.presentRequests.get(conn.channel);
    const entry = [...(requests?.entries() ?? [])].find(([c]) => c.publicId === id);
    if (!entry || !requests) return;
    const [requester, mode] = entry;
    if (allow && this.presentations.has(conn.channel)) {
      return this.send(conn, { t: "notice", message: "Stop the current presentation first." });
    }
    requests.delete(requester);
    if (requests.size === 0) this.presentRequests.delete(conn.channel);
    this.sendRequests(conn.channel);
    if (!allow) return this.send(requester, { t: "notice", message: "The owner said not now." });
    this.send(requester, { t: "notice", message: "The owner said yes: you are presenting!" });
    this.startPresentation(requester, mode);
  }

  private startPresentation(conn: Connection, mode: PresentMode): void {
    this.presentRequests.get(conn.channel)?.delete(conn);
    this.presentations.set(conn.channel, { presenter: conn, mode, page: 1, pages: null, file: null });
    this.broadcastPresentation(conn.channel);
    this.sendRequests(conn.channel);
  }

  /** Ends the room's presentation: the screen share stops being announced and the slides are deleted. */
  private endPresentation(channel: string): void {
    const p = this.presentations.get(channel);
    if (!p) return;
    this.presentations.delete(channel);
    if (p.presenter.media.screen !== null) {
      p.presenter.media = { ...p.presenter.media, screen: null };
      if (p.presenter.callKey) this.sendCall(p.presenter.callKey);
    }
    this.broadcastPresentation(channel);
  }

  private presentStop(conn: Connection): void {
    const p = this.presentations.get(conn.channel);
    if (!p) return;
    if (p.presenter !== conn && !this.isOwner(conn)) return this.rejectInvalid(conn);
    this.endPresentation(conn.channel);
  }

  private presentPage(conn: Connection, page: number, pages: number): void {
    const p = this.presentations.get(conn.channel);
    if (!p || p.presenter !== conn || p.mode !== "pdf" || !p.file) return;
    p.pages = pages;
    p.page = Math.min(page, pages);
    this.broadcastPresentation(conn.channel);
  }

  /** A connection left its channel: drop its requests and end its presentation. */
  private leavePresentations(conn: Connection, channel: string): void {
    const requests = this.presentRequests.get(channel);
    if (requests?.delete(conn)) {
      if (requests.size === 0) this.presentRequests.delete(channel);
      this.sendRequests(channel);
    }
    if (this.presentations.get(channel)?.presenter === conn) this.endPresentation(channel);
  }

  /** The approved PDF presenter uploads the slides (POST /api/rooms/:id/slides). */
  acceptSlides(guestId: string, roomId: string, data: Buffer): SlidesUpload {
    const channel = roomChannel(roomId);
    const p = this.presentations.get(channel);
    if (!p || p.presenter.guestId !== guestId || p.mode !== "pdf") {
      return { ok: false, status: 403, error: "not_presenter", message: "Only the approved presenter can show slides." };
    }
    if (data.length === 0 || data.length > SLIDES_MAX_BYTES) {
      return { ok: false, status: 415, error: "bad_file", message: "Slides must be a PDF of at most 10 MB." };
    }
    if (data.subarray(0, 5).toString("latin1") !== "%PDF-") {
      return { ok: false, status: 415, error: "not_pdf", message: "That file is not a PDF." };
    }
    p.file = { token: randomBytes(18).toString("base64url"), data };
    p.page = 1;
    p.pages = null;
    this.broadcastPresentation(channel);
    return { ok: true };
  }

  /** The slides, only for a guest who is inside that room right now. */
  slidesFor(guestId: string, roomId: string, token: string): Buffer | null {
    const channel = roomChannel(roomId);
    const p = this.presentations.get(channel);
    if (!p?.file || p.file.token !== token) return null;
    const inside = [...this.conns.values()].some((c) => c.guestId === guestId && c.channel === channel);
    return inside ? p.file.data : null;
  }

  /** Signals only flow between two members of the same call. Anything else is dropped. */
  private relaySignal(conn: Connection, to: string, data: VoiceSignalData): void {
    if (!conn.callKey) return;
    const target = this.callMembers(conn.callKey).find((c) => c.publicId === to);
    if (!target || target === conn) return;
    this.send(target, { t: "signal", from: conn.publicId, data });
  }

  private async onEnter(conn: Connection, roomId: string, password: string | undefined): Promise<void> {
    if (conn.entering || conn.channel === roomChannel(roomId)) return;
    conn.entering = true;
    try {
      const result = await this.gate.check({ guestId: conn.guestId, roomId, password, occupants: this.occupancy(roomId) });
      if (this.conns.get(conn.ws) !== conn) return; // socket closed while we were checking
      if (!result.ok) {
        this.send(conn, { t: "enter_failed", code: result.code, message: result.message });
        return;
      }
      // Re-check space: others may have entered during the async check.
      if (!result.owner && this.occupancy(roomId) >= result.room.capacity) {
        this.send(conn, { t: "enter_failed", code: "full", message: `This room is full (${result.room.capacity} guests).` });
        return;
      }
      this.moveTo(conn, { kind: "room", room: result.room, owner: result.owner });
    } catch {
      this.send(conn, { t: "enter_failed", code: "not_found", message: "Could not open that room. Try again." });
    } finally {
      conn.entering = false;
    }
  }

  private takeChatToken(guestId: string): boolean {
    const now = this.opts.now();
    const bucket = this.chatBuckets.get(guestId) ?? { tokens: this.opts.chatBurst, at: now };
    bucket.tokens = Math.min(this.opts.chatBurst, bucket.tokens + (now - bucket.at) / 1000 / this.opts.chatRefillSeconds);
    bucket.at = now;
    this.chatBuckets.set(guestId, bucket);
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  private onChat(conn: Connection, raw: string): void {
    const text = validateChat(raw);
    if (!text.ok) {
      this.send(conn, { t: "error", code: "chat_invalid", message: text.message });
      return this.rejectInvalid(conn);
    }
    if (!this.takeChatToken(conn.guestId)) {
      this.send(conn, { t: "error", code: "chat_rate_limited", message: "Slow down, the ghosts can't read that fast." });
      return;
    }
    const msg: ChatMessage = {
      id: (++this.chatSeq).toString(36),
      from: conn.publicId,
      name: conn.profile.name,
      text: text.value,
      at: this.opts.clock(),
    };
    const history = this.histories.get(conn.channel) ?? [];
    history.push(msg);
    if (history.length > CHAT_HISTORY) history.shift();
    this.histories.set(conn.channel, history);
    // Echo to the sender too: the echo is the delivery receipt.
    this.broadcast(conn.channel, { t: "chat", msg });
  }

  private tick(): void {
    const byChannel = new Map<string, SnapshotRow[]>();
    for (const c of this.conns.values()) {
      if (!c.dirty) continue;
      c.dirty = false;
      const rows = byChannel.get(c.channel) ?? [];
      rows.push([c.publicId, round2(c.move.pos.x), round2(c.move.pos.z), round2(c.ry)]);
      byChannel.set(c.channel, rows);
    }
    for (const [channel, rows] of byChannel) this.broadcast(channel, { t: "snap", p: rows });
  }

  private heartbeat(): void {
    for (const c of this.conns.values()) {
      if (!c.alive) {
        c.ws.terminate();
        continue;
      }
      c.alive = false;
      c.ws.ping();
    }
  }

  private toPublic(c: Connection): PublicPlayer {
    return {
      id: c.publicId,
      name: c.profile.name,
      look: c.profile.look,
      x: round2(c.move.pos.x),
      z: round2(c.move.pos.z),
      ry: round2(c.ry),
      ...(c.snack ? { snack: c.snack.id } : {}),
      ...(c.seat ? { seat: { ...c.seat } } : {}),
    };
  }

  private send(conn: Connection, msg: ServerMessage): void {
    this.sendRaw(conn, JSON.stringify(msg));
  }

  private sendRaw(conn: Connection, payload: string): void {
    if (conn.ws.readyState !== conn.ws.OPEN) return;
    if (conn.ws.bufferedAmount > this.opts.maxBufferedBytes) {
      conn.ws.terminate();
      return;
    }
    conn.ws.send(payload);
  }

  /** Sends only to connections in `channel`. This is the isolation boundary between rooms. */
  private broadcast(channel: string, msg: ServerMessage, except?: Connection): void {
    const payload = JSON.stringify(msg);
    for (const c of this.conns.values()) if (c.channel === channel && c !== except) this.sendRaw(c, payload);
  }
}
