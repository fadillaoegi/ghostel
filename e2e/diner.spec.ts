import { expect, test, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";

const SHOTS = "docs/evidence/screenshots";

async function checkIn(browser: Browser, name: string, options: BrowserContextOptions = {}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: /Check in/ }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Live");
  return { context, page };
}

async function ride(page: Page, label: RegExp) {
  await page.getByRole("button", { name: "Elevator", exact: true }).click();
  await page.getByRole("button", { name: label }).click();
}

/** Holds a key until the prompt of `kind` shows (slow frames make fixed-time walks unreliable). */
async function walkToPrompt(page: Page, key: string, kind: string, maxMs = 15_000) {
  const prompt = page.getByTestId("door-prompt");
  await page.keyboard.down(key);
  const started = Date.now();
  try {
    while (Date.now() - started < maxMs) {
      if ((await prompt.getAttribute("data-prompt", { timeout: 50 }).catch(() => null)) === kind) return;
      await page.waitForTimeout(40);
    }
  } finally {
    await page.keyboard.up(key);
  }
}

test("Ghoul's Diner: order a snack at the counter, a friend on the floor sees it", async ({ browser }) => {
  const hank = await checkIn(browser, "Hungry Hank");
  const dot = await checkIn(browser, "Diner Dot");
  for (const g of [hank, dot]) {
    await ride(g.page, /Floor 4/);
    await expect(g.page.getByTestId("place-name")).toHaveText("4F · Ghoul's Diner");
  }

  // From the elevator (west end of the north wall): a step south, then east to the counter.
  await hank.page.keyboard.down("KeyS");
  await hank.page.waitForTimeout(450);
  await hank.page.keyboard.up("KeyS");
  await walkToPrompt(hank.page, "KeyD", "counter");
  const prompt = hank.page.getByTestId("door-prompt");
  await expect(prompt).toHaveText("🍽️ Press E to order a snack");
  await hank.page.keyboard.press("KeyE");
  await expect(hank.page.getByTestId("snack-menu")).toBeVisible();
  await hank.page.screenshot({ path: `${SHOTS}/desktop-diner-menu.png` });
  await hank.page.getByRole("button", { name: "Order Worm Noodles" }).click();
  await expect(hank.page.getByTestId("snack-menu")).toHaveCount(0);
  await expect(hank.page.getByTestId("chat-log")).toContainText("Order up! Enjoy your Worm Noodles.");
  await expect(dot.page.getByTestId("chat-log")).toContainText("Hungry Hank ordered Worm Noodles");
  await hank.page.waitForTimeout(700);
  await hank.page.screenshot({ path: `${SHOTS}/desktop-diner-snack.png` });

  await dot.context.close();
  await hank.context.close();
});
