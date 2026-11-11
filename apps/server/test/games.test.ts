import { BOT_ID, DEFAULT_LOOK, type GameView, type PairsConfig, type PairsView, type ServerMessage, type TriviaConfig, type TriviaView } from "@ghostel/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { api, openSocket, putMe, sessionCookie, startServer, type TestServer, type TestSocket } from "./helpers";

const TIMING: TriviaConfig = {
  rounds: 2,
  introMs: 150,
  questionMs: 2500,
  revealMs: 300,
  podiumMs: 300,
  botMinMs: 300,
  botMaxMs: 500,
  botAccuracy: 1,
};

const PAIRS: PairsConfig = { pairs: 3, introMs: 150, turnMs: 2500, peekMs: 150, podiumMs: 300, botMinMs: 60, botMaxMs: 90, botMemory: 1 };

let server: TestServer;
const sockets: TestSocket[] = [];

beforeAll(async () => {
  server = await startServer({ trivia: TIMING, pairs: PAIRS, roomWritesPerMinute: 10_000 });
});
afterAll(async () => {
  await server.close();
});
beforeEach(async () => {
  await server.pool.query("TRUNCATE guests CASCADE");
});
afterEach(async () => {
  for (const s of sockets.splice(0)) s.ws.terminate();
  await new Promise((r) => setTimeout(r, 50));
});

async function guest(name: string): Promise<string> {
  return sessionCookie((await putMe(server, { name, look: DEFAULT_LOOK })).res) as string;
}

async function room(cookie: string, game: "none" | "pumpkin_trivia" | "monster_pairs" = "pumpkin_trivia"): Promise<string> {
  const res = await api(server, "POST", "/api/rooms", cookie, { name: "Game Table", access: "open", decor: "ballroom", game });
  return res.json?.["room"].id as string;
}

async function connect(cookie: string) {
  const s = await openSocket(server, cookie);
  sockets.push(s);
  const welcome = await s.next("welcome");
  return { s, id: welcome.selfId };
}

async function into(s: TestSocket, roomId: string) {
  const from = s.messages.length;
  s.send({ t: "enter", room: roomId });
  return after(s, from, "welcome", (m) => m.place.kind === "room" && m.place.room.id === roomId);
}

/** Waits for a message that arrives after `from` (TestSocket.next also matches older messages). */
function after<T extends ServerMessage["t"]>(
  s: TestSocket,
  from: number,
  type: T,
  where: (m: Extract<ServerMessage, { t: T }>) => boolean = () => true,
  timeoutMs = 5000,
): Promise<Extract<ServerMessage, { t: T }>> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      const hit = s.messages.slice(from).find((m) => m.t === type && where(m as Extract<ServerMessage, { t: T }>));
      if (hit) return resolve(hit as Extract<ServerMessage, { t: T }>);
      if (Date.now() - started > timeoutMs) return reject(new Error(`timed out waiting for ${type}`));
      setTimeout(poll, 10);
    };
    poll();
  });
}

const trivia = (v: GameView | null | undefined): TriviaView | undefined => (v?.game === "pumpkin_trivia" ? v : undefined);
const pairs = (v: GameView | null | undefined): PairsView | undefined => (v?.game === "monster_pairs" ? v : undefined);
const views = (s: TestSocket) => s.messages.flatMap((m) => (m.t === "game" ? [m.view] : []));
const nextView = (s: TestSocket, phase: GameView["phase"], timeoutMs = 5000) =>
  s.next("game", (m) => m.view?.phase === phase, timeoutMs).then((m) => m.view as GameView);

describe("pumpkin trivia on the server", () => {
  it("refuses to start in the lobby, in hang-out rooms, or twice", async () => {
    const owner = await guest("Olga");
    const a = await connect(owner);
    a.s.send({ t: "game_start" });
    expect((await a.s.next("game_denied")).message).toBe("Games are played at a room's table.");

    await into(a.s, await room(owner, "none"));
    a.s.send({ t: "game_start" });
    expect((await a.s.next("game_denied", (m) => m.message.includes("hanging out"))).message).toBe("This room is just for hanging out.");

    const mark = a.s.messages.length;
    a.s.send({ t: "exit" });
    await after(a.s, mark, "welcome", (m) => m.place.kind === "lobby");
    await into(a.s, await room(owner));
    a.s.send({ t: "game_start" });
    await nextView(a.s, "intro");
    a.s.send({ t: "game_start" });
    expect((await a.s.next("game_denied", (m) => m.message.includes("already"))).message).toBe("A game is already running.");
  });

  it("a solo guest plays a full game against the bot without ever seeing answers early", async () => {
    const owner = await guest("Olga");
    const a = await connect(owner);
    await into(a.s, await room(owner));
    a.s.send({ t: "game_start" });

    const intro = await nextView(a.s, "intro");
    expect(intro.players.map((p) => [p.id, p.bot])).toEqual([
      [a.id, false],
      [BOT_ID, true],
    ]);

    for (let round = 0; round < TIMING.rounds; round++) {
      const q = await a.s.next("game", (m) => m.view?.phase === "question" && trivia(m.view)?.round === round + 1);
      expect(trivia(q.view)?.question?.options).toHaveLength(4);
      const mark = a.s.messages.length;
      a.s.send({ t: "game_action", action: { round, choice: 0 } });
      // Either the bot has not answered yet (we see our own pick) or the question closes at once.
      const mine = await after(a.s, mark, "game");
      expect(mine.view?.phase === "reveal" || trivia(mine.view)?.myChoice === 0).toBe(true);
      const reveal = await a.s.next("game", (m) => m.view?.phase === "reveal" && trivia(m.view)?.round === round + 1);
      expect(trivia(reveal.view)?.reveal?.picks[a.id]).toBe(0);
      expect(typeof trivia(reveal.view)?.reveal?.correct).toBe("number");
    }
    await nextView(a.s, "podium");
    // When the podium ends the game is removed.
    await a.s.next("game", (m) => m.view === null);

    // No message during a question ever carried the answer.
    for (const v of views(a.s)) if (v?.phase === "question") expect(JSON.stringify(v)).not.toMatch(/correct|picks|gained/);
    const bot = views(a.s).filter((v): v is GameView => v !== null).at(-1)?.players.find((p) => p.id === BOT_ID);
    expect(bot?.score).toBeGreaterThan(0); // accuracy 1 in this test config
  });

  it("two players share questions, picks stay private until the reveal, spectators cannot answer", async () => {
    const owner = await guest("Olga");
    const roomId = await room(owner);
    const a = await connect(owner);
    const b = await connect(await guest("Vic"));
    await into(a.s, roomId);
    await into(b.s, roomId);
    a.s.send({ t: "game_start" });

    const qa = trivia(await nextView(a.s, "question"));
    const qb = trivia(await nextView(b.s, "question"));
    expect(qa?.question).toEqual(qb?.question);
    expect(qa?.players.some((p) => p.bot)).toBe(false);

    // A late guest watches; their answer is ignored.
    const late = await connect(await guest("Late Lantern"));
    const lateWelcome = await into(late.s, roomId);
    expect(lateWelcome.game?.phase).toBe("question");
    late.s.send({ t: "game_action", action: { round: 0, choice: 1 } });

    a.s.send({ t: "game_action", action: { round: 0, choice: 2 } });
    const bSees = trivia((await b.s.next("game", (m) => (trivia(m.view)?.answered ?? []).includes(a.id))).view);
    expect(bSees?.myChoice).toBeNull(); // b cannot see a's pick
    expect(JSON.stringify(bSees)).not.toContain('"myChoice":2');
    expect(bSees?.answered).not.toContain(late.id);

    a.s.send({ t: "game_action", action: { round: 0, choice: 3 } }); // second answer ignored
    b.s.send({ t: "game_action", action: { round: 0, choice: 1 } });
    const reveal = trivia(await nextView(b.s, "reveal"));
    expect(reveal?.reveal?.picks).toEqual({ [a.id]: 2, [b.id]: 1 });
  });

  it("keeps game traffic inside the room", async () => {
    const owner = await guest("Olga");
    const a = await connect(owner);
    const lobby = await connect(await guest("Larry"));
    await into(a.s, await room(owner));
    a.s.send({ t: "game_start" });
    await nextView(a.s, "question");
    await new Promise((r) => setTimeout(r, 300));
    expect(lobby.s.messages.filter((m: ServerMessage) => m.t === "game")).toEqual([]);
  });

  it("drops the game when the last player leaves, even with spectators inside", async () => {
    const owner = await guest("Olga");
    const roomId = await room(owner);
    const a = await connect(owner);
    await into(a.s, roomId);
    a.s.send({ t: "game_start" });
    await nextView(a.s, "intro");
    const watcher = await connect(await guest("Wanda Watcher"));
    expect((await into(watcher.s, roomId)).game?.phase).toBeDefined();
    a.s.send({ t: "exit" });
    expect((await watcher.s.next("game", (m) => m.view === null)).view).toBeNull();
  });

  it("malformed actions count as invalid messages", async () => {
    const owner = await guest("Olga");
    const a = await connect(owner);
    await into(a.s, await room(owner));
    a.s.send({ t: "game_start" });
    await nextView(a.s, "intro");
    for (let i = 0; i < 20; i++) a.s.send({ t: "game_action", action: { round: 0, choice: 9, hack: true } });
    expect((await a.s.closed).code).toBe(4001);
  });
});

describe("monster pairs on the same game kit", () => {
  /** Waits for a play view where it is `id`'s turn and nothing is being shown. */
  const myTurn = (s: TestSocket, id: string, from: number, timeoutMs = 8000) =>
    after(s, from, "game", (m) => pairs(m.view)?.current === id && pairs(m.view)?.peek === false && pairs(m.view)?.cards.every((c) => c.state !== "up") === true, timeoutMs).then(
      (m) => pairs(m.view) as PairsView,
    );

  it("two players take turns; faces of cards that are down are never sent; only the current player flips", async () => {
    const owner = await guest("Olga");
    const roomId = await room(owner, "monster_pairs");
    const a = await connect(owner);
    const b = await connect(await guest("Vic"));
    await into(a.s, roomId);
    await into(b.s, roomId);
    const mark = a.s.messages.length;
    b.s.send({ t: "game_start" });

    const first = await myTurn(a.s, a.id, mark);
    expect(first.players.map((p) => p.id)).toEqual([a.id, b.id]);
    expect(first.cards).toHaveLength(PAIRS.pairs * 2);
    expect(first.cards.every((c) => c.state === "down")).toBe(true);

    // Vic cannot flip on Olga's turn.
    const vicTry = b.s.messages.length;
    b.s.send({ t: "game_action", action: { turn: first.turn, card: 0 } });
    await new Promise((r) => setTimeout(r, 150));
    expect(b.s.messages.slice(vicTry).some((m) => m.t === "game" && pairs(m.view)?.cards[0]?.state === "up")).toBe(false);

    // Olga flips card 0: both see that one face only.
    const flipMark = b.s.messages.length;
    a.s.send({ t: "game_action", action: { turn: first.turn, card: 0 } });
    const seen = pairs((await after(b.s, flipMark, "game", (m) => pairs(m.view)?.cards[0]?.state === "up")).view) as PairsView;
    expect(seen.cards.filter((c) => "face" in c)).toHaveLength(1);
    // A stale action from an older turn is ignored.
    a.s.send({ t: "game_action", action: { turn: first.turn - 1, card: 1 } });

    // Play the game out. Both players remember every face they have seen (like real players would)
    // and flip a known pair when they can; otherwise a card they have not seen yet.
    const known = new Map<number, string>();
    const choose = (v: PairsView): number => {
      v.cards.forEach((c, i) => "face" in c && known.set(i, c.face));
      const down = v.cards.flatMap((c, i) => (c.state === "down" ? [i] : []));
      const up = v.cards.findIndex((c) => c.state === "up");
      if (up >= 0) return down.find((i) => known.get(i) === known.get(up)) ?? down.find((i) => !known.has(i)) ?? down[0] ?? -1;
      const pair = down.find((i) => down.some((j) => j !== i && known.has(i) && known.get(j) === known.get(i)));
      return pair ?? down.find((i) => !known.has(i)) ?? down[0] ?? -1;
    };
    const deadline = Date.now() + 20_000;
    let podium: PairsView | undefined;
    while (!podium && Date.now() < deadline) {
      for (const x of views(a.s)) if (pairs(x)) pairs(x)?.cards.forEach((c, i) => "face" in c && known.set(i, c.face));
      const v = pairs([...views(a.s)].reverse().find((x) => x !== null));
      if (v?.phase === "podium") podium = v;
      else if (v?.phase === "play" && !v.peek) {
        const player = v.current === a.id ? a : v.current === b.id ? b : null;
        const card = choose(v);
        if (player && card >= 0) player.s.send({ t: "game_action", action: { turn: v.turn, card } });
      }
      await new Promise((r) => setTimeout(r, 40));
    }
    expect(podium?.players.reduce((n, p) => n + p.score, 0)).toBe(PAIRS.pairs);
    expect(podium?.cards.every((c) => c.state === "matched")).toBe(true);
    await a.s.next("game", (m) => m.view === null);

    // Over the whole game, a card's face only travelled while that card was up or matched.
    for (const m of [...a.s.messages, ...b.s.messages]) {
      const v = m.t === "game" ? pairs(m.view) : undefined;
      for (const c of v?.cards ?? []) if (c.state === "down") expect(Object.keys(c)).toEqual(["state"]);
    }
  }, 30_000);

  it("a solo guest plays Jack O'Bot; a late spectator cannot act; malformed actions are invalid", async () => {
    const owner = await guest("Olga");
    const roomId = await room(owner, "monster_pairs");
    const a = await connect(owner);
    await into(a.s, roomId);
    const mark = a.s.messages.length;
    a.s.send({ t: "game_start" });
    const v = await myTurn(a.s, a.id, mark);
    expect(v.players.map((p) => [p.id, p.bot])).toEqual([
      [a.id, false],
      [BOT_ID, true],
    ]);

    const late = await connect(await guest("Late Lantern"));
    const welcome = await into(late.s, roomId);
    expect(welcome.game?.game).toBe("monster_pairs");
    const lateMark = a.s.messages.length;
    late.s.send({ t: "game_action", action: { turn: v.turn, card: 0 } });
    await new Promise((r) => setTimeout(r, 150));
    expect(a.s.messages.slice(lateMark).some((m) => m.t === "game" && pairs(m.view)?.cards[0]?.state === "up")).toBe(false);

    // Let the timer pass Olga's turn: the bot plays.
    const botTurn = await after(a.s, mark, "game", (m) => pairs(m.view)?.current === BOT_ID, 5000);
    expect(pairs(botTurn.view)?.current).toBe(BOT_ID);

    for (let i = 0; i < 20; i++) late.s.send({ t: "game_action", action: { turn: "x", card: 0 } });
    expect((await late.s.closed).code).toBe(4001);
  });
});
