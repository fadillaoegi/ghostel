import { expect, test, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";

const SHOTS = "docs/evidence/screenshots";
const PHONE: BrowserContextOptions = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function checkIn(browser: Browser, name: string, options: BrowserContextOptions = {}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: /Check in/ }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Live");
  return { context, page };
}

async function ride(page: Page, floor: number, label: RegExp) {
  await page.getByRole("button", { name: "Elevator", exact: true }).click();
  await expect(page.getByTestId("elevator-panel")).toBeVisible();
  await page.getByRole("button", { name: label }).click();
}

test("the elevator connects five floors, each with its own guests, ghosts and chat", async ({ browser }) => {
  const eve = await checkIn(browser, "Elevator Eve");
  const lobby = await checkIn(browser, "Lobby Leo");

  await ride(eve.page, 2, /Floor 2/);
  await expect(eve.page.getByTestId("place-name")).toHaveText("2F · Hall of Portraits");
  await expect(eve.page.getByTestId("nametag-npc")).toHaveText(["👻 The Curator", "👻 Lady Whisper"]);
  await expect(lobby.page.getByTestId("nametag")).toHaveCount(0); // Eve left the lobby
  await expect(eve.page.getByTestId("guest-count")).toHaveText("1 guest haunting");
  await eve.page.waitForTimeout(900);
  await eve.page.screenshot({ path: `${SHOTS}/desktop-floor2-gallery.png` });

  // Floor chat stays on the floor.
  await eve.page.getByRole("textbox", { name: "Message" }).fill("The portraits are watching me");
  await eve.page.getByRole("textbox", { name: "Message" }).press("Enter");
  await expect(eve.page.getByTestId("chat-log")).toContainText("The portraits are watching me");
  await lobby.page.waitForTimeout(500);
  await expect(lobby.page.getByTestId("chat-log")).not.toContainText("portraits");

  // Walk the length of the gallery: pick up the runway candy, reach the Mirror of Costumes.
  // Walk until the mirror prompt shows: slow frames are clamped, so a fixed walking time is not a fixed distance.
  await eve.page.keyboard.down("KeyD");
  const walkStart = Date.now();
  while (Date.now() - walkStart < 25_000) {
    if ((await eve.page.getByTestId("door-prompt").getAttribute("data-prompt", { timeout: 50 }).catch(() => null)) === "mirror") break;
    await eve.page.waitForTimeout(40);
  }
  await eve.page.waitForTimeout(400);
  await eve.page.keyboard.up("KeyD");
  await expect(eve.page.getByTestId("candy-count")).toHaveText("🍬 1/12");
  await expect(eve.page.getByTestId("chat-log")).toContainText("You found a candy!");
  await expect(eve.page.getByTestId("door-prompt")).toHaveAttribute("data-prompt", "mirror");
  await eve.page.keyboard.press("KeyE");
  await expect(eve.page.getByTestId("creator")).toBeVisible();
  await expect(eve.page.getByRole("radio", { name: /Golden crown/ })).toHaveAttribute("aria-disabled", "true");
  await eve.page.getByRole("button", { name: "Cancel" }).click();

  await ride(eve.page, 3, /Floor 3/);
  await expect(eve.page.getByTestId("place-name")).toHaveText("3F · Moonlit Greenhouse");
  await expect(eve.page.getByTestId("nametag-npc")).toHaveText(["👻 Gourdon the Gardener", "👻 Moldy Mo"]);
  await eve.page.waitForTimeout(900);
  await eve.page.screenshot({ path: `${SHOTS}/desktop-floor3-greenhouse.png` });

  await ride(eve.page, 4, /Floor 4/);
  await expect(eve.page.getByTestId("place-name")).toHaveText("4F · Ghoul's Diner");
  await expect(eve.page.getByTestId("nametag-npc")).toHaveText(["👻 Chef Bones", "👻 Count Crumbs"]);
  await eve.page.waitForTimeout(900);
  await eve.page.screenshot({ path: `${SHOTS}/desktop-floor4-diner.png` });

  await ride(eve.page, 5, /Floor 5/);
  await expect(eve.page.getByTestId("place-name")).toHaveText("5F · Rooftop Graveyard");
  await expect(eve.page.getByTestId("nametag-npc")).toHaveText(["👻 Stargazer Stella", "👻 Zorp, Tourist"]);
  await eve.page.waitForTimeout(900);
  await eve.page.screenshot({ path: `${SHOTS}/desktop-floor5-rooftop.png` });

  // Back to the lobby, stepping out of the lobby elevator.
  await ride(eve.page, 1, /Floor 1/);
  await expect(eve.page.getByTestId("place-name")).toHaveText("Grand Lobby");
  await expect(lobby.page.getByTestId("nametag").filter({ hasText: "Elevator Eve" })).toBeVisible();
  await expect(eve.page.getByTestId("door-prompt")).toHaveAttribute("data-prompt", "elevator");

  await lobby.context.close();
  await eve.context.close();
});

test("the welcome candy sits next to the front doors", async ({ browser }) => {
  const c = await checkIn(browser, "Candy Cass");
  await expect(c.page.getByTestId("candy-count")).toHaveText("🍬 0/12");
  await c.page.keyboard.down("KeyD");
  await c.page.waitForTimeout(2500);
  await c.page.keyboard.up("KeyD");
  await expect(c.page.getByTestId("candy-count")).toHaveText("🍬 1/12");
  // The count survives a reload (stored on the server).
  await c.page.reload();
  await expect(c.page.getByTestId("candy-count")).toHaveText("🍬 1/12");
  await c.context.close();
});

test("phone: floors through the elevator button", async ({ browser }) => {
  const p = await checkIn(browser, "Mobile Mo", PHONE);
  for (const [n, name] of [
    [2, "gallery"],
    [3, "greenhouse"],
    [4, "diner"],
    [5, "rooftop"],
  ] as const) {
    await ride(p.page, n, new RegExp(`Floor ${n}`));
    await expect(p.page.getByTestId("place-name")).toContainText(`${n}F`);
    await p.page.waitForTimeout(900);
    await p.page.screenshot({ path: `${SHOTS}/phone-floor${n}-${name}.png` });
  }
  await p.context.close();
});
