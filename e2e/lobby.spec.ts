import { expect, test, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";

const SHOTS = "docs/evidence/screenshots";

const PHONE: BrowserContextOptions = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};

async function checkIn(browser: Browser, name: string, options: BrowserContextOptions = {}, head = "💀 Skull") {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByTestId("creator")).toBeVisible();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("radio", { name: head, exact: true }).click();
  await page.getByRole("button", { name: /Check in/ }).click();
  await expect(page.getByTestId("lobby")).toBeVisible();
  await expect(page.getByTestId("connection-status")).toHaveText("Live");
  await expect(page.getByTestId("nametag-self")).toHaveText(name);
  return { context, page };
}

function tag(page: Page, name: string) {
  return page.getByTestId("nametag").filter({ hasText: new RegExp(`^${name}$`) });
}

async function tagX(page: Page, name: string): Promise<number> {
  const box = await tag(page, name).boundingBox();
  if (!box) throw new Error(`${name} tag not visible`);
  return box.x;
}

test("two guests see each other move, rename and leave in realtime", async ({ browser }) => {
  const alice = await checkIn(browser, "Alice Ghoul", {}, "🎃 Pumpkin");
  await expect(alice.page.getByTestId("guest-count")).toHaveText("1 guest haunting");

  const bob = await checkIn(browser, "Bob Banshee", {}, "🐱 Black cat");

  // Both see each other.
  await expect(tag(alice.page, "Bob Banshee")).toBeVisible();
  await expect(tag(bob.page, "Alice Ghoul")).toBeVisible();
  await expect(alice.page.getByTestId("guest-count")).toHaveText("2 guests haunting");
  await expect(bob.page.getByTestId("guest-count")).toHaveText("2 guests haunting");

  // Bob walks right; Alice's camera is still, so Bob's tag moves right on Alice's screen.
  const before = await tagX(alice.page, "Bob Banshee");
  await bob.page.keyboard.down("KeyD");
  await bob.page.waitForTimeout(1200);
  await bob.page.keyboard.up("KeyD");
  await expect.poll(() => tagX(alice.page, "Bob Banshee"), { timeout: 10_000 }).toBeGreaterThan(before + 40);

  // Walk Bob up a bit so the desktop screenshot shows both guests in the hall.
  await bob.page.keyboard.down("KeyW");
  await bob.page.waitForTimeout(700);
  await bob.page.keyboard.up("KeyW");
  await alice.page.waitForTimeout(1500);
  await alice.page.screenshot({ path: `${SHOTS}/desktop-lobby-two-guests.png` });

  // Rename is visible to the other guest without a reload.
  await bob.page.getByRole("button", { name: /Edit costume/ }).click();
  await bob.page.getByLabel("Your name").fill("Bob Renamed");
  await bob.page.getByRole("radio", { name: /Witch/ }).click();
  await bob.page.getByRole("button", { name: "Save costume" }).click();
  await expect(tag(alice.page, "Bob Renamed")).toBeVisible();
  await expect(tag(alice.page, "Bob Banshee")).toHaveCount(0);

  // Reload keeps the profile (cookie session + PostgreSQL).
  await bob.page.reload();
  await expect(bob.page.getByTestId("lobby")).toBeVisible();
  await expect(bob.page.getByTestId("nametag-self")).toHaveText("Bob Renamed");
  await bob.page.getByRole("button", { name: /Edit costume/ }).click();
  await expect(bob.page.getByRole("radio", { name: /Witch/ })).toHaveAttribute("aria-checked", "true");
  await expect(bob.page.getByRole("radio", { name: /Black cat/ })).toHaveAttribute("aria-checked", "true");
  await bob.page.getByRole("button", { name: "Cancel" }).click();

  // Closing Bob's tab removes his character for Alice.
  await bob.context.close();
  await expect(tag(alice.page, "Bob Renamed")).toHaveCount(0);
  await expect(alice.page.getByTestId("guest-count")).toHaveText("1 guest haunting");

  await alice.context.close();
});

test("invalid names are rejected with a clear message", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/desktop-creator.png` });

  await page.getByLabel("Your name").fill("x");
  await page.getByRole("button", { name: /Check in/ }).click();
  await expect(page.getByRole("alert")).toHaveText("Name must be at least 2 characters.");
  await expect(page.getByTestId("creator")).toBeVisible();

  // Bypass the browser-side check: the server must reject it too, with the same clear message.
  const res = await page.request.put("/api/me", {
    headers: { origin: new URL(page.url()).origin },
    data: { name: "<b>hacker</b>", look: { body: "violet", accent: "pumpkin", head: "round", hat: "none", costume: "none" } },
  });
  expect(res.status()).toBe(400);
  expect(await res.json()).toEqual({
    error: "invalid_profile",
    field: "name",
    message: "Name can use letters, numbers, spaces and - _ . ' and must start with a letter or number.",
  });
  await page.screenshot({ path: `${SHOTS}/desktop-creator-invalid-name.png` });
  await context.close();
});

test("phone layout: creator, lobby and joystick movement", async ({ browser }) => {
  const context = await browser.newContext(PHONE);
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByTestId("creator")).toBeVisible();
  await page.getByLabel("Your name").fill("Mina Mummy");
  await page.getByRole("radio", { name: /Mummy wraps/ }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/phone-creator.png` });

  // The panel must fit the phone width (no horizontal overflow).
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: /Check in/ }).click();
  await expect(page.getByTestId("lobby")).toBeVisible();
  await expect(page.getByTestId("connection-status")).toHaveText("Live");
  const stick = page.getByTestId("joystick");
  await expect(stick).toBeVisible();

  // A second guest on desktop watches the phone guest walk with the joystick.
  const watcher = await checkIn(browser, "Desk Watcher");
  await expect(tag(watcher.page, "Mina Mummy")).toBeVisible();
  const before = await tagX(watcher.page, "Mina Mummy");

  const box = await stick.boundingBox();
  if (!box) throw new Error("joystick missing");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 45, cy, { steps: 5 });
  await page.waitForTimeout(1200);
  await page.mouse.up();
  await expect.poll(() => tagX(watcher.page, "Mina Mummy"), { timeout: 10_000 }).toBeGreaterThan(before + 30);

  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/phone-lobby.png` });
  await watcher.context.close();
  await context.close();
});

test("monster costume parts are saved by the server and shown to other guests", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Your name").fill("Vlad Visitor");
  await page.getByRole("radio", { name: "🧛 Vampire", exact: true }).click();
  await page.getByRole("radio", { name: /Pirate$/ }).click();
  await page.getByRole("radio", { name: "🦇 Bat wings", exact: true }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/desktop-creator-monsters.png` });
  await page.getByRole("button", { name: /Check in/ }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Live");

  // The look survives a reload: the server accepted the new parts.
  await page.reload();
  await expect(page.getByTestId("connection-status")).toHaveText("Live");
  await page.getByRole("button", { name: "Edit costume" }).click();
  for (const part of [/Vampire$/, /Pirate$/, /Bat wings$/]) {
    await expect(page.getByRole("radio", { name: part })).toHaveAttribute("aria-checked", "true");
  }
  // Switch to a werewolf in fur and save.
  await page.getByRole("radio", { name: "🐺 Werewolf", exact: true }).click();
  await page.getByRole("radio", { name: "🐾 Werewolf fur", exact: true }).click();
  await page.getByRole("button", { name: /Save/ }).click();
  await expect(page.getByTestId("creator")).toHaveCount(0);

  const friend = await checkIn(browser, "Frank Friend", {}, "🧟 Zombie");
  await expect(tag(friend.page, "Vlad Visitor")).toBeVisible();
  await expect(tag(page, "Frank Friend")).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/desktop-lobby-monsters.png` });
  await friend.context.close();
  await context.close();
});
