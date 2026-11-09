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
