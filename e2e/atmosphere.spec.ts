import { expect, test, type BrowserContextOptions } from "@playwright/test";

const SHOTS = "docs/evidence/screenshots";
const PHONE: BrowserContextOptions = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

test("a solo visitor finds ghosts, a greeting and house rooms", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Your name").fill("Lonely Larry");
  await page.getByRole("button", { name: /Check in/ }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Live");

  // Staff ghosts are there, but they are not counted as guests.
  const npcs = page.getByTestId("nametag-npc");
  await expect(npcs).toHaveCount(5);
  for (const name of ["Wisp", "Boo-ella", "Sir Floats-a-Lot", "Sergeant Wraps", "Mortimer, Concierge"]) {
    await expect(npcs.filter({ hasText: name })).toHaveCount(1);
  }
  await expect(page.getByTestId("guest-count")).toHaveText("1 guest haunting");
  await expect(page.getByTestId("nametag")).toHaveCount(0);

  // Mortimer greets the guest by name.
  await expect(page.getByTestId("npc-bubble").filter({ hasText: "Welcome to Ghostel, Lonely Larry!" })).toHaveText(
    "Welcome to Ghostel, Lonely Larry! Rooms and games are through the glowing doors 🚪",
    { timeout: 5000 },
  );

  // The ghosts move on their own.
  const wisp = npcs.filter({ hasText: "Wisp" });
  const before = await wisp.boundingBox();
  await page.waitForTimeout(1500);
  const after = await wisp.boundingBox();
  expect(Math.hypot((after?.x ?? 0) - (before?.x ?? 0), (after?.y ?? 0) - (before?.y ?? 0))).toBeGreaterThan(5);
  await page.screenshot({ path: `${SHOTS}/desktop-lobby-ghosts.png` });

  // Ambience toggle.
  const toggle = page.getByRole("button", { name: "Music" });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(page.getByRole("button", { name: "Music" })).toHaveAttribute("aria-pressed", "false");

  // House rooms are always in the directory, behind doors 1A–1C.
  await page.getByRole("button", { name: "Rooms" }).click();
  for (const [code, name] of [
    ["1A", "Pumpkin Trivia Hall"],
    ["1B", "Midnight Library"],
    ["1C", "The Quiet Crypt"],
  ] as const) {
    const card = page.getByTestId("room-card").filter({ hasText: name });
    await expect(card).toContainText("by The Concierge");
    await expect(card).toContainText(code);
  }
  await page.getByRole("button", { name: "Enter Pumpkin Trivia Hall" }).click();
  await expect(page.getByTestId("place-name")).toHaveText("🔓 1A · Pumpkin Trivia Hall");
  await expect(page.getByTestId("nametag-npc")).toHaveText("👻 The Host");
  await expect(page.getByRole("button", { name: "🎃 Play Pumpkin Trivia" })).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/desktop-house-room.png` });
  await context.close();
});

test("phone: the HUD shows the room name and ghosts are visible", async ({ browser }) => {
  const context = await browser.newContext(PHONE);
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Your name").fill("Mina Mummy");
  await page.getByRole("button", { name: /Check in/ }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Live");
  await expect(page.getByTestId("npc-bubble").first()).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: `${SHOTS}/phone-lobby-ghosts.png` });

  await page.getByRole("button", { name: "Rooms" }).click();
  await page.getByRole("button", { name: "Enter Midnight Library" }).click();
  await expect(page.getByTestId("place-name")).toBeVisible();
  await expect(page.getByTestId("place-name")).toHaveText("🔓 1B · Midnight Library");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/phone-house-room.png` });
  await context.close();
});
