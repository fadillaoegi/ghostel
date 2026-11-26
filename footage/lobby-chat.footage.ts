import { mkdirSync } from "node:fs";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { OUT, typeSlowly } from "./helpers";
import { startRecording } from "./record";

// Footage for the demo video: live chat in the Grand Lobby with four guests. The recorded guest uses the real UI.
// The three friends are real guests too (cookie session, WebSocket, server-checked moves and chat), driven from
// blank pages so only one 3D scene has to render while recording.

type Look = { body: string; accent: string; head: string; hat: string; costume: string };

interface Bot {
  page: Page;
  close: () => Promise<void>;
  say: (text: string) => Promise<void>;
  walkTo: (x: number, z: number, speed?: number) => Promise<void>;
  /** Where the recorded guest stands (from this bot's own welcome). */
  host: { x: number; z: number };
}

async function joinAsBot(browser: Browser, name: string, look: Look, hostName: string): Promise<Bot> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/api/health");
  const origin = new URL(page.url()).origin;
  const res = await page.request.put("/api/me", { headers: { origin }, data: { name, look } });
  expect(res.status()).toBe(200);
  const host = await page.evaluate(
    async ({ url, hostName }) => {
      type Pos = { x: number; z: number };
      const ws = new WebSocket(url);
      const w = window as unknown as {
        __bot: { pos: Pos; ry: number; epoch: number; ws: WebSocket };
      };
      const welcome = await new Promise<{ selfId: string; epoch: number; players: { id: string; name: string; x: number; z: number }[] }>((resolve, reject) => {
        ws.onmessage = (e) => {
          const msg = JSON.parse(String(e.data)) as { t: string };
          if (msg.t === "welcome") resolve(msg as never);
        };
        ws.onerror = () => reject(new Error("socket failed"));
      });
      const me = welcome.players.find((p) => p.id === welcome.selfId);
      w.__bot = { pos: { x: me?.x ?? 0, z: me?.z ?? 7 }, ry: Math.PI, epoch: welcome.epoch, ws };
      // Server corrections (an obstacle, too fast) move us to where the server says.
      ws.addEventListener("message", (e) => {
        const msg = JSON.parse(String(e.data)) as { t: string; x?: number; z?: number };
        if (msg.t === "correct" && typeof msg.x === "number" && typeof msg.z === "number") w.__bot.pos = { x: msg.x, z: msg.z };
      });
      const hostP = welcome.players.find((p) => p.name === hostName);
      return hostP ? { x: hostP.x, z: hostP.z } : { x: 0, z: 7.5 };
    },
    { url: `${origin.replace(/^http/, "ws")}/ws`, hostName },
  );

  return {
    page,
    host,
    close: () => context.close(),
    say: (text) =>
      page.evaluate((t) => {
        (window as unknown as { __bot: { ws: WebSocket } }).__bot.ws.send(JSON.stringify({ t: "chat", text: t }));
      }, text),
    walkTo: (x, z, speed = 3) =>
      page.evaluate(
        async ({ x, z, speed }) => {
          const b = (window as unknown as { __bot: { pos: { x: number; z: number }; ry: number; epoch: number; ws: WebSocket } }).__bot;
          const step = 0.1; // seconds between moves (10 Hz, under the 20 Hz client limit)
          const deadline = Date.now() + (Math.hypot(x - b.pos.x, z - b.pos.z) / speed) * 2000 + 2000;
          while (Date.now() < deadline) {
            const dx = x - b.pos.x;
            const dz = z - b.pos.z;
            const dist = Math.hypot(dx, dz);
            if (dist < 0.05) break;
            const d = Math.min(dist, speed * step);
            b.ry = Math.atan2(dx, dz);
            b.pos = { x: b.pos.x + (dx / dist) * d, z: b.pos.z + (dz / dist) * d };
            b.ws.send(JSON.stringify({ t: "move", x: Math.round(b.pos.x * 100) / 100, z: Math.round(b.pos.z * 100) / 100, ry: b.ry, e: b.epoch }));
            await new Promise((r) => setTimeout(r, step * 1000));
          }
        },
        { x, z, speed },
      ),
  };
}

test("Grand Lobby: live chat with four guests", async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  const HOST = "Pumpkin Pete";
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Your name").fill(HOST);
  await page.getByRole("radio", { name: "🎃 Pumpkin", exact: true }).click();
  await page.getByRole("button", { name: /Check in/ }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Live");
  await page.waitForTimeout(2500);

  const vlad = await joinAsBot(browser, "Vlad", { body: "midnight", accent: "blood", head: "vampire", hat: "top", costume: "cape" }, HOST);
  const luna = await joinAsBot(browser, "Luna Howl", { body: "ash", accent: "moon", head: "werewolf", hat: "none", costume: "fur" }, HOST);
  const bones = await joinAsBot(browser, "Mr Bones", { body: "bone", accent: "slime", head: "skull", hat: "pirate", costume: "skeleton" }, HOST);
  const h = vlad.host;
  // Park the friends off to the sides first (at most MAX_SPEED 5), so they can walk in on camera.
  await Promise.all([vlad.walkTo(-7.5, h.z - 3, 4.5), luna.walkTo(7.5, h.z - 3.5, 4.5), bones.walkTo(4.5, -2.5, 4.5)]);
  await page.waitForTimeout(2500);

  const stop = await startRecording(page, "lobby-chat");
  const input = page.getByRole("textbox", { name: "Message" });
  const iSay = async (text: string) => {
    await page.keyboard.press("Enter");
    await expect(input).toBeFocused();
    await typeSlowly(page, text, 70);
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");
  };
  const log = page.getByTestId("chat-log");

  await page.waitForTimeout(1200);
  // The friends walk up and gather round.
  await Promise.all([vlad.walkTo(h.x - 1.9, h.z - 1.4), luna.walkTo(h.x + 1.9, h.z - 1.2), bones.walkTo(h.x + 0.2, h.z - 3)]);
  await page.waitForTimeout(800);

  await vlad.say("Good evening, mortals 🧛");
  await page.waitForTimeout(2200);
  await iSay("Hey everyone! Just checked in 🎃");
  await page.waitForTimeout(1600);
  await luna.say("Welcome! The moon is full on the rooftop tonight 🌕");
  await page.waitForTimeout(2600);
  await bones.say("Anyone up for Pumpkin Trivia in 1A?");
  await page.waitForTimeout(2000);
  await iSay("I'm in! Loser buys snacks at the Diner 🍔");
  await page.waitForTimeout(1600);
  await vlad.say("Only if they serve tomato juice 🍅");
  await page.waitForTimeout(2400);
  await luna.say("Race you to door 1A! 🐺");
  await page.waitForTimeout(900);
  // Door 1A is on the west wall of the lobby (x -14, z -3).
  const toDoor = Promise.all([luna.walkTo(-12.8, -3, 3.6), vlad.walkTo(-12.8, -2.2, 3.2)]);
  await page.waitForTimeout(900);
  await bones.say("Wait for me, my legs keep falling off 💀");
  await page.waitForTimeout(1200);
  const bonesGo = bones.walkTo(-12.8, -3.8, 2.2);
  await iSay("See you in 1A 👻");
  await expect(log).toContainText("See you in 1A");
  await Promise.all([toDoor, bonesGo]);
  await page.waitForTimeout(2500);

  const file = `${OUT}/lobby-chat-four-guests.mp4`;
  const result = await stop(file);
  console.log(`footage: ${file}, ${result.frames} frames over ${result.seconds.toFixed(1)} s`);
  await Promise.all([vlad.close(), luna.close(), bones.close()]);
  await context.close();
});
