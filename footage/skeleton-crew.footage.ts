import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { OUT } from "./helpers";
import { startRecording } from "./record";

// Footage for the demo video: the Ghostel Game Kit (M17), Ghostel's Skeleton Crew echo. One `GameEngine`
// interface, two very different games: Pumpkin Trivia (house room 1A, everyone answers at once) and Monster Pairs
// (house room 1B, turn-based memory). Both against Jack O'Bot. The footage server runs short games (TRIVIA_FAST).

async function enterHouseRoom(page: Page, name: string) {
  await page.getByRole("button", { name: "Rooms" }).click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: `Enter ${name}` }).click();
  await expect(page.getByTestId("place-name")).toContainText(name);
  await page.waitForTimeout(2500);
}

async function leaveRoom(page: Page) {
  await page.getByRole("button", { name: "Leave room", exact: true }).click();
  await expect(page.getByTestId("place-name")).toHaveText("Grand Lobby");
  await page.waitForTimeout(1500);
}

/** Plays our Monster Pairs turns at a human pace, remembering faces, until the podium shows. */
async function playPairs(page: Page, maxMs = 120_000) {
  const panel = page.getByTestId("pairs");
  const cards = page.getByTestId("pairs-card");
  const known = new Map<number, string>();
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    if (await page.getByTestId("pairs-podium").isVisible()) return;
    const states = await cards.evaluateAll((els) => els.map((e) => ({ state: e.getAttribute("data-state"), face: e.getAttribute("data-face") })));
    states.forEach((c, i) => c.face && known.set(i, c.face));
    if ((await panel.getAttribute("data-turn").catch(() => null)) === "mine") {
      const down = states.flatMap((c, i) => (c.state === "down" ? [i] : []));
      const up = states.findIndex((c) => c.state === "up");
      const pick =
        up >= 0
          ? (down.find((i) => known.get(i) === known.get(up)) ?? down.find((i) => !known.has(i)) ?? down[0])
          : (down.find((i) => known.has(i) && down.some((j) => j !== i && known.get(j) === known.get(i))) ?? down.find((i) => !known.has(i)) ?? down[0]);
      if (pick !== undefined) {
        await page.waitForTimeout(700);
        await cards.nth(pick).click({ timeout: 600 }).catch(() => undefined);
        await page.waitForTimeout(500);
        continue;
      }
    }
    await page.waitForTimeout(120);
  }
  throw new Error("Monster Pairs did not reach the podium in time");
}

test("Skeleton Crew: one game kit, two games", async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Your name").fill("Bonnie Bones");
  await page.getByRole("radio", { name: "💀 Skull", exact: true }).click();
  await page.getByRole("button", { name: /Check in/ }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Live");
  await page.waitForTimeout(2500);

  const stop = await startRecording(page, "skeleton-crew");
  await page.waitForTimeout(1200);

  // 1. Game one: Pumpkin Trivia in house room 1A.
  await enterHouseRoom(page, "Pumpkin Trivia Hall");
  await page.getByRole("button", { name: "🎃 Play Pumpkin Trivia" }).click();
  const trivia = page.getByTestId("trivia");
  await expect(trivia).toHaveAttribute("data-phase", "intro");
  for (let round = 1; round <= 3; round++) {
    await expect(trivia).toHaveAttribute("data-phase", "question", { timeout: 15_000 });
    await page.waitForTimeout(2600);
    await page.getByTestId("trivia-option").nth(round % 4).click();
    await expect(trivia).toHaveAttribute("data-phase", "reveal", { timeout: 15_000 });
    await page.waitForTimeout(1200);
  }
  await expect(page.getByTestId("trivia-podium")).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(3500);
  await leaveRoom(page);

  // 2. Game two, same kit: Monster Pairs in house room 1B.
  await enterHouseRoom(page, "Midnight Library");
  await page.getByRole("button", { name: "🃏 Play Monster Pairs" }).click();
  const pairs = page.getByTestId("pairs");
  await expect(pairs).toHaveAttribute("data-phase", "play", { timeout: 15_000 });
  await playPairs(page);
  await page.waitForTimeout(4000);

  const file = `${OUT}/skeleton-crew-game-kit.mp4`;
  const result = await stop(file);
  console.log(`footage: ${file}, ${result.frames} frames over ${result.seconds.toFixed(1)} s`);
  await context.close();
});
