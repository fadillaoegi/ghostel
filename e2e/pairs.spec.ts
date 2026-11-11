import { expect, test, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";

// M17: Monster Pairs on the Ghostel Game Kit. The E2E server runs with TRIVIA_FAST=1: 4 pairs, short peeks.
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

/** Plays our turns like a person with a good memory until the podium shows. */
async function playToPodium(page: Page, shot?: string, maxMs = 75_000) {
  const panel = page.getByTestId("pairs");
  const cards = page.getByTestId("pairs-card");
  const known = new Map<number, string>();
  const started = Date.now();
  let shotTaken = false;
  while (Date.now() - started < maxMs) {
    if (await page.getByTestId("pairs-podium").isVisible()) return;
    const states = await cards.evaluateAll((els) => els.map((e) => ({ state: e.getAttribute("data-state"), face: e.getAttribute("data-face") })));
    // A card that is down never carries its face in the page.
    expect(states.filter((c) => c.state === "down" && c.face !== null)).toEqual([]);
    states.forEach((c, i) => c.face && known.set(i, c.face));
    if (shot && !shotTaken && states.filter((c) => c.state === "matched").length >= 2) {
      await page.screenshot({ path: shot });
      shotTaken = true;
    }
    if ((await panel.getAttribute("data-turn").catch(() => null)) === "mine") {
      const down = states.flatMap((c, i) => (c.state === "down" ? [i] : []));
      const up = states.findIndex((c) => c.state === "up");
      const pick =
        up >= 0
          ? (down.find((i) => known.get(i) === known.get(up)) ?? down.find((i) => !known.has(i)) ?? down[0])
          : (down.find((i) => known.has(i) && down.some((j) => j !== i && known.get(j) === known.get(i))) ?? down.find((i) => !known.has(i)) ?? down[0]);
      if (pick !== undefined) await cards.nth(pick).click({ timeout: 400 }).catch(() => undefined);
    }
    await page.waitForTimeout(120);
  }
  throw new Error("Monster Pairs did not reach the podium in time");
}

test("Monster Pairs: a solo guest plays Jack O'Bot in house room 1B to the podium", async ({ browser }) => {
  const g = await checkIn(browser, "Mira Memory");
  await g.page.getByRole("button", { name: "Rooms" }).click();
  await g.page.getByRole("button", { name: "Enter Midnight Library" }).click();
  await expect(g.page.getByTestId("place-name")).toHaveText("🔓 1B · Midnight Library");

  await g.page.getByRole("button", { name: "🃏 Play Monster Pairs" }).click();
  const panel = g.page.getByTestId("pairs");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Jack O'Bot");
  await expect(panel).toHaveAttribute("data-phase", "play", { timeout: 10_000 });
  await expect(g.page.getByTestId("pairs-card")).toHaveCount(8);

  await playToPodium(g.page, `${SHOTS}/desktop-pairs-board.png`);
  await expect(g.page.getByTestId("podium-row")).toHaveCount(2);
  await g.page.waitForTimeout(600);
  await g.page.screenshot({ path: `${SHOTS}/desktop-pairs-podium.png` });

  // The results stay with "Play again" after the server ends the game.
  await expect(g.page.getByRole("button", { name: "🃏 Play again" })).toBeVisible({ timeout: 10_000 });
  await g.page.getByRole("button", { name: "🃏 Play again" }).click();
  await expect(panel).toHaveAttribute("data-phase", /intro|play/);
  await g.context.close();
});

test("phone: flip cards with taps in house room 1B; the room form offers Monster Pairs", async ({ browser }) => {
  const p = await checkIn(browser, "Tappy Tess", PHONE);
  // The create form offers the game (no room is created, so later specs keep their free doors).
  await p.page.getByRole("button", { name: "Rooms" }).click();
  await p.page.getByRole("button", { name: /Create a room/ }).click();
  await expect(p.page.getByRole("radio", { name: "🃏 Monster Pairs" })).toBeVisible();
  await p.page.getByRole("button", { name: "Back" }).click();
  await p.page.getByRole("button", { name: "Enter Midnight Library" }).click();
  await expect(p.page.getByTestId("place-name")).toHaveText("🔓 1B · Midnight Library");

  await p.page.getByRole("button", { name: "🃏 Play Monster Pairs" }).click();
  const panel = p.page.getByTestId("pairs");
  await expect(panel).toHaveAttribute("data-turn", "mine", { timeout: 10_000 });
  const cards = p.page.getByTestId("pairs-card");
  await cards.nth(0).tap();
  await expect(cards.nth(0)).toHaveAttribute("data-state", /up|matched/);
  await cards.nth(1).tap();
  await expect(cards.nth(1)).toHaveAttribute("data-state", /up|matched/);
  await p.page.waitForTimeout(500);
  await p.page.screenshot({ path: `${SHOTS}/phone-pairs-board.png` });
  await p.context.close();
});
