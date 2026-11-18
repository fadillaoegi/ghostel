import { expect, test, type Browser, type BrowserContextOptions } from "@playwright/test";

const SHOTS = "docs/evidence/screenshots";

const PHONE: BrowserContextOptions = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};

async function checkIn(browser: Browser, name: string, options: BrowserContextOptions = {}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: /Check in/ }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Live");
  return { context, page };
}

test("guests chat in the lobby with speech bubbles", async ({ browser }) => {
  const alice = await checkIn(browser, "Alice Ghoul");
  const bob = await checkIn(browser, "Bob Banshee");
  await expect(alice.page.getByTestId("chat-log")).toContainText("Bob Banshee arrived");

  // Desktop: Enter focuses the chat field, Enter again sends.
  await alice.page.keyboard.press("Enter");
  await expect(alice.page.getByRole("textbox", { name: "Message" })).toBeFocused();
  await alice.page.keyboard.type("Boo! Happy Kiroween 🎃");
  await alice.page.keyboard.press("Enter");
  await expect(alice.page.getByRole("textbox", { name: "Message" })).toHaveValue("");
  // After sending, the keyboard goes back to walking.
  await expect(alice.page.getByRole("textbox", { name: "Message" })).not.toBeFocused();

  const bobLog = bob.page.getByTestId("chat-log");
  await expect(bobLog).toContainText("Alice Ghoul");
  await expect(bobLog).toContainText("Boo! Happy Kiroween 🎃");
  await expect(bob.page.getByTestId("bubble").filter({ hasText: "Boo! Happy Kiroween 🎃" })).toBeVisible();

  // Typing WASD in the chat field writes text instead of walking.
  await bob.page.getByRole("textbox", { name: "Message" }).fill("");
  await bob.page.getByRole("textbox", { name: "Message" }).pressSequentially("wasd works");
  await bob.page.getByRole("button", { name: "Send message" }).click();
  await expect(alice.page.getByTestId("chat-log")).toContainText("wasd works");
  await expect(alice.page.getByTestId("bubble").filter({ hasText: "wasd works" })).toBeVisible();

  // HTML is shown as text, never rendered.
  await alice.page.getByRole("textbox", { name: "Message" }).fill("<img src=x onerror=alert(1)>");
  await alice.page.getByRole("textbox", { name: "Message" }).press("Enter");
  await expect(bob.page.getByTestId("chat-log")).toContainText("<img src=x onerror=alert(1)>");
  await expect(bob.page.locator(".chat-log img")).toHaveCount(0);

  await alice.page.waitForTimeout(500);
  await alice.page.screenshot({ path: `${SHOTS}/desktop-lobby-chat.png` });

  // Bubbles fade after about 6 seconds.
  await expect(bob.page.getByTestId("bubble")).toHaveCount(0, { timeout: 10_000 });

  // A late guest sees recent history.
  const late = await checkIn(browser, "Late Lantern");
  await expect(late.page.getByTestId("chat-log")).toContainText("Boo! Happy Kiroween 🎃");

  await late.context.close();
  await expect(alice.page.getByTestId("chat-log")).toContainText("Late Lantern left");
  await bob.context.close();
  await alice.context.close();
});

test("flooding the chat is stopped by the server", async ({ browser }) => {
  const spammer = await checkIn(browser, "Spammy Specter");
  const input = spammer.page.getByRole("textbox", { name: "Message" });
  for (let i = 1; i <= 8; i++) {
    await input.fill(`spam ${i}`);
    await input.press("Enter");
  }
  await expect(spammer.page.getByRole("alert")).toHaveText("Slow down, the ghosts can't read that fast.");
  // Burst is 5: later messages were not echoed back.
  await expect(spammer.page.getByTestId("chat-log")).toContainText("spam 5");
  await expect(spammer.page.getByTestId("chat-log")).not.toContainText("spam 8");
  await spammer.context.close();
});

test("phone: chat sheet with unread badge", async ({ browser }) => {
  const phone = await checkIn(browser, "Mina Mummy", PHONE);
  const desk = await checkIn(browser, "Desk Watcher");

  await desk.page.getByRole("textbox", { name: "Message" }).fill("Mina, come to the fountain!");
  await desk.page.getByRole("textbox", { name: "Message" }).press("Enter");
  await expect(phone.page.getByTestId("unread")).toHaveText("1");
  await expect(phone.page.getByTestId("bubble")).toHaveText("Mina, come to the fountain!");
  await phone.page.waitForTimeout(400);
  await phone.page.screenshot({ path: `${SHOTS}/phone-lobby-bubble.png` });

  await phone.page.getByRole("button", { name: /Open chat/ }).click();
  await expect(phone.page.getByTestId("joystick")).toHaveCount(0);
  await expect(phone.page.getByTestId("chat-log")).toContainText("Mina, come to the fountain!");
  await phone.page.getByRole("textbox", { name: "Message" }).fill("On my way 👻");
  await phone.page.getByRole("button", { name: "Send message" }).click();
  await expect(desk.page.getByTestId("chat-log")).toContainText("On my way 👻");
  await phone.page.screenshot({ path: `${SHOTS}/phone-chat-sheet.png` });

  await phone.page.getByRole("button", { name: "Close chat" }).click();
  await expect(phone.page.getByTestId("joystick")).toBeVisible();
  await expect(phone.page.getByTestId("unread")).toHaveCount(0);

  await desk.context.close();
  await phone.context.close();
});

/**
 * A guest without the 3D page: checks in over the API and chats over a raw WebSocket from a blank same-origin page.
 * Each guest may send 5 messages at once (CHAT_BURST), so a few of them fill the history quickly.
 */
async function chatBot(browser: Browser, name: string, texts: string[]) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/api/health");
  const origin = new URL(page.url()).origin;
  const res = await page.request.put("/api/me", {
    headers: { origin },
    data: { name, look: { body: "violet", accent: "pumpkin", head: "round", hat: "none", costume: "none" } },
  });
  expect(res.status()).toBe(200);
  const echoed = await page.evaluate(
    async ({ url, texts }) => {
      const ws = new WebSocket(url);
      const got: string[] = [];
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error("socket failed"));
      });
      const done = new Promise<void>((resolve) => {
        ws.onmessage = (e) => {
          const msg = JSON.parse(String(e.data)) as { t: string; msg?: { text: string } };
          if (msg.t === "chat" && msg.msg && texts.includes(msg.msg.text)) got.push(msg.msg.text);
          if (got.length === texts.length) resolve();
        };
        setTimeout(resolve, 5000);
      });
      for (const text of texts) ws.send(JSON.stringify({ t: "chat", text }));
      await done;
      ws.close();
      return got.length;
    },
    { url: `${origin.replace(/^http/, "ws")}/ws`, texts },
  );
  expect(echoed).toBe(texts.length);
  await context.close();
}

test("the chat panel shows the newest 15 messages and loads earlier ones by scrolling up (M23)", async ({ browser }) => {
  const label = (n: number) => `night note ${String(n).padStart(2, "0")}`;
  for (let bot = 0; bot < 4; bot++) {
    await chatBot(
      browser,
      `Scribe ${bot + 1}`,
      [1, 2, 3, 4, 5].map((i) => label(bot * 5 + i)),
    );
  }

  const reader = await checkIn(browser, "Reader Raven");
  const log = reader.page.getByTestId("chat-log");
  await expect(log).toContainText(label(20));
  await expect(log.locator(".chat-line")).toHaveCount(15);
  await expect(log).toContainText(label(6));
  await expect(log).not.toContainText(label(5));
  await expect(reader.page.getByTestId("chat-more")).toBeVisible();
  await reader.page.screenshot({ path: `${SHOTS}/desktop-chat-15.png` });

  // Infinite scroll: reaching the top of the log asks the server for the page before the oldest message.
  const scrollable = await log.evaluate((el) => el.scrollHeight > el.clientHeight);
  if (scrollable) {
    await log.evaluate((el) => {
      el.scrollTop = 0;
      el.dispatchEvent(new Event("scroll"));
    });
  } else {
    // A short log cannot scroll; the button at its top does the same.
    await reader.page.getByTestId("chat-more").click();
  }
  await expect(log).toContainText(label(1));
  // Earlier tests in this run chatted in the lobby too, so there are at least our 20.
  expect(await log.locator(".chat-line").count()).toBeGreaterThanOrEqual(20);
  // The view stayed where the reader was: the old top message (06) is still on screen.
  await expect(log.getByText(label(6))).toBeInViewport();
  console.log(`chat log was ${scrollable ? "scrollable (scroll path tested)" : "not scrollable (button path tested)"}`);
  // Keep going until the start of the day's history: then the button is gone.
  for (let i = 0; i < 40 && (await reader.page.getByTestId("chat-more").count()) > 0; i++) {
    await reader.page.getByTestId("chat-more").click();
    await reader.page.waitForTimeout(150);
  }
  await expect(reader.page.getByTestId("chat-more")).toHaveCount(0);

  // A new message brings the reader back to the newest 15 once they are at the bottom again.
  await reader.page.getByRole("textbox", { name: "Message" }).fill("back to the present");
  await reader.page.getByRole("textbox", { name: "Message" }).press("Enter");
  await expect(log).toContainText("back to the present");
  await expect(log.locator(".chat-line")).toHaveCount(15);
  await reader.context.close();
});
