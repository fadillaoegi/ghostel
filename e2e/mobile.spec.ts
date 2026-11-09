import { expect, test, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";

const SHOTS = "docs/evidence/screenshots";
const PORTRAIT: BrowserContextOptions = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const LANDSCAPE: BrowserContextOptions = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function checkIn(browser: Browser, name: string, options: BrowserContextOptions = {}, init?: () => void) {
  const context = await browser.newContext(options);
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: /Check in/ }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Live");
  return { context, page };
}

/** Everything in `testIds` is fully on screen. */
async function expectOnScreen(page: Page, testIds: string[]) {
  const vw = page.viewportSize()?.width ?? 0;
  const vh = page.viewportSize()?.height ?? 0;
  for (const id of testIds) {
    const box = await page.getByTestId(id).boundingBox();
    expect(box, id).not.toBeNull();
    if (!box) continue;
    expect(box.x, `${id} left`).toBeGreaterThanOrEqual(0);
    expect(box.y, `${id} top`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${id} right`).toBeLessThanOrEqual(vw + 0.5);
    expect(box.y + box.height, `${id} bottom`).toBeLessThanOrEqual(vh + 0.5);
  }
}

test("phone portrait: stick and action button; the action button calls the elevator", async ({ browser }) => {
  const p = await checkIn(browser, "Pocket Pat", PORTRAIT);
  await expectOnScreen(p.page, ["joystick", "action-button"]);
  await expect(p.page.getByTestId("action-button")).toBeDisabled();

  await p.page.getByRole("button", { name: "Elevator", exact: true }).click();
  await p.page.getByRole("button", { name: /Floor 2/ }).click();
  await expect(p.page.getByTestId("place-name")).toHaveText("2F · Hall of Portraits");
  // Guests step out of the elevator inside its prompt: the action button offers it.
  const action = p.page.getByTestId("action-button");
  await expect(action).toHaveAccessibleName("Action: Elevator");
  await p.page.waitForTimeout(600);
  await p.page.screenshot({ path: `${SHOTS}/phone-gamepad-portrait.png` });
  await action.tap();
  await expect(p.page.getByTestId("elevator-panel")).toBeVisible();
  await p.context.close();
});

test("phone landscape: creator, lobby HUD, panels and chat all fit the short screen", async ({ browser }) => {
  const context = await browser.newContext(LANDSCAPE);
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByTestId("creator")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.getByLabel("Your name").fill("Wide Wanda");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/phone-landscape-creator.png` });
  const checkInButton = page.getByRole("button", { name: /Check in/ });
  await checkInButton.scrollIntoViewIfNeeded();
  await checkInButton.click();
  await expect(page.getByTestId("connection-status")).toHaveText("Live");

  await expectOnScreen(page, ["joystick", "action-button", "place-name", "candy-count"]);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/phone-landscape-lobby.png` });

  // The stick moves the character.
  const watcher = await checkIn(browser, "Desk Watcher");
  const tag = watcher.page.getByTestId("nametag").filter({ hasText: /^Wide Wanda$/ });
  await expect(tag).toBeVisible();
  const before = (await tag.boundingBox())?.x ?? 0;
  const stick = (await page.getByTestId("joystick").boundingBox())!;
  await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2);
  await page.mouse.down();
  await page.mouse.move(stick.x + stick.width / 2 + 45, stick.y + stick.height / 2, { steps: 5 });
  await page.waitForTimeout(1000);
  await page.mouse.up();
  await expect.poll(async () => (await tag.boundingBox())?.x ?? 0, { timeout: 10_000 }).toBeGreaterThan(before + 30);
  await watcher.context.close();

  // Panels scroll inside the short screen instead of running off it.
  await page.getByRole("button", { name: "Elevator", exact: true }).click();
  const panel = page.getByTestId("elevator-panel").locator(".modal-panel");
  const box = (await panel.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(390.5);
  await page.screenshot({ path: `${SHOTS}/phone-landscape-elevator.png` });
  await page.getByRole("button", { name: "Close" }).click();

  // Chat opens as a side panel and the message box is reachable.
  await page.getByRole("button", { name: "Open chat" }).click();
  const message = page.getByRole("textbox", { name: "Message" });
  await expect(message).toBeVisible();
  const input = (await message.boundingBox())!;
  expect(input.y + input.height).toBeLessThanOrEqual(390.5);
  await page.screenshot({ path: `${SHOTS}/phone-landscape-chat.png` });
  await context.close();
});

test("a physical gamepad walks the character, A does the action, B closes the panel", async ({ browser }) => {
  // A fake standard-mapping gamepad the test drives through window.__pad.
  const fakePad = () => {
    const state = { axes: [0, 0, 0, 0], pressed: new Array(17).fill(false) as boolean[] };
    (window as unknown as { __pad: typeof state }).__pad = state;
    navigator.getGamepads = () =>
      [
        {
          id: "Test pad",
          index: 0,
          connected: true,
          mapping: "standard",
          timestamp: performance.now(),
          axes: state.axes,
          buttons: state.pressed.map((p) => ({ pressed: p, touched: p, value: p ? 1 : 0 })),
          hapticActuators: [],
          vibrationActuator: null,
        },
      ] as unknown as (Gamepad | null)[];
  };
  const gamer = await checkIn(browser, "Gamer Gil", {}, fakePad);
  const watcher = await checkIn(browser, "Desk Watcher");
  const tag = watcher.page.getByTestId("nametag").filter({ hasText: /^Gamer Gil$/ });
  await expect(tag).toBeVisible();
  const before = (await tag.boundingBox())?.x ?? 0;
  await gamer.page.evaluate(() => ((window as unknown as { __pad: { axes: number[] } }).__pad.axes[0] = 1));
  await expect.poll(async () => (await tag.boundingBox())?.x ?? 0, { timeout: 10_000 }).toBeGreaterThan(before + 30);
  await gamer.page.evaluate(() => ((window as unknown as { __pad: { axes: number[] } }).__pad.axes[0] = 0));
  await watcher.context.close();

  await gamer.page.getByRole("button", { name: "Elevator", exact: true }).click();
  await gamer.page.getByRole("button", { name: /Floor 3/ }).click();
  await expect(gamer.page.getByTestId("door-prompt")).toHaveAttribute("data-prompt", "elevator");
  const press = async (button: number) => {
    await gamer.page.evaluate((b) => ((window as unknown as { __pad: { pressed: boolean[] } }).__pad.pressed[b] = true), button);
    await gamer.page.waitForTimeout(150);
    await gamer.page.evaluate((b) => ((window as unknown as { __pad: { pressed: boolean[] } }).__pad.pressed[b] = false), button);
    await gamer.page.waitForTimeout(150);
  };
  await press(0);
  await expect(gamer.page.getByTestId("elevator-panel")).toBeVisible();
  await press(1);
  await expect(gamer.page.getByTestId("elevator-panel")).toHaveCount(0);
  await gamer.context.close();
});
