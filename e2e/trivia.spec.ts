import { expect, test, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";

// The E2E server runs with TRIVIA_FAST=1: 3 questions, 12 s each (answering ends a question early), short reveal and podium.
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

async function openTriviaRoom(page: Page, name: string) {
  await page.getByRole("button", { name: "Rooms" }).click();
  await page.getByRole("button", { name: /Create a room/ }).click();
  await page.getByLabel("Room name").fill(name);
  await page.getByRole("radio", { name: "🕯️ Ballroom" }).click();
  await page.getByRole("radio", { name: "🎃 Pumpkin Trivia" }).click();
  await page.getByRole("button", { name: "Open the room" }).click();
  await expect(page.getByTestId("place-name")).toHaveText(new RegExp(`^🔓 [123][A-F] · ${name}$`));
}

test("solo guest plays Pumpkin Trivia against the bot to the podium", async ({ browser }) => {
  const solo = await checkIn(browser, "Sally Solo");
  await openTriviaRoom(solo.page, "Pumpkin Patch");

  await solo.page.getByRole("button", { name: "🎃 Play Pumpkin Trivia" }).click();
  const panel = solo.page.getByTestId("trivia");
  await expect(panel).toHaveAttribute("data-phase", "intro");
  await expect(panel).toContainText("Jack O'Bot");

  for (let round = 1; round <= 3; round++) {
    await expect(solo.page.getByTestId("trivia-round")).toHaveText(`Question ${round}/3`);
    await expect(panel).toHaveAttribute("data-phase", "question");
    if (round === 1) await solo.page.screenshot({ path: `${SHOTS}/desktop-trivia-question.png` });
    // Answer with the keyboard on round 2, by clicking otherwise.
    if (round === 2) await solo.page.keyboard.press("2");
    else await solo.page.getByTestId("trivia-option").first().click();
    await expect(panel).toHaveAttribute("data-phase", "reveal", { timeout: 10_000 });
    await expect(solo.page.locator(".opt--correct")).toHaveCount(1);
    await expect(solo.page.getByTestId("trivia-status")).toContainText(/Correct!|Not this time/);
    if (round === 1) await solo.page.screenshot({ path: `${SHOTS}/desktop-trivia-reveal.png` });
  }

  await expect(solo.page.getByTestId("trivia-podium")).toBeVisible({ timeout: 10_000 });
  await expect(solo.page.getByTestId("podium-row")).toHaveCount(2);
  await solo.page.waitForTimeout(600);
  await solo.page.screenshot({ path: `${SHOTS}/desktop-trivia-podium.png` });

  // After the podium the results stay with a Play again button.
  await expect(solo.page.getByRole("button", { name: "🎃 Play again" })).toBeVisible({ timeout: 10_000 });
  await solo.page.getByRole("button", { name: "🎃 Play again" }).click();
  await expect(panel).toHaveAttribute("data-phase", "intro");
  await solo.context.close();
});

test("two guests see the same question and each other's picks after the reveal", async ({ browser }) => {
  const olga = await checkIn(browser, "Olga Owner");
  const vic = await checkIn(browser, "Vic Visitor", PHONE);
  await openTriviaRoom(olga.page, "Quiz Crypt");
  await vic.page.getByRole("button", { name: "Rooms" }).click();
  await vic.page.getByRole("button", { name: "Enter Quiz Crypt" }).click();
  await expect(vic.page.getByTestId("place-name")).toHaveText(/^🔓 [123][A-F] · Quiz Crypt$/);

  await vic.page.getByRole("button", { name: "🎃 Play Pumpkin Trivia" }).click();
  await expect(olga.page.getByTestId("trivia")).toHaveAttribute("data-phase", "question", { timeout: 10_000 });
  await expect(vic.page.getByTestId("trivia")).toHaveAttribute("data-phase", "question");
  const question = await olga.page.getByTestId("trivia-question").textContent();
  await expect(vic.page.getByTestId("trivia-question")).toHaveText(question ?? "");
  // No bot when two humans play.
  await expect(olga.page.getByTestId("scoreboard")).not.toContainText("Jack O'Bot");

  await olga.page.getByTestId("trivia-option").nth(0).click();
  await expect(olga.page.getByTestId("trivia-status")).toContainText("Locked in!");
  // Vic only learns that Olga answered, not what.
  await expect(vic.page.getByTestId("scoreboard")).toContainText("✓");
  await expect(vic.page.locator(".opt--mine")).toHaveCount(0);
  await vic.page.screenshot({ path: `${SHOTS}/phone-trivia-question.png` });

  await vic.page.getByTestId("trivia-option").nth(1).click();
  // Both answered: the reveal comes at once and shows who picked what.
  await expect(vic.page.getByTestId("trivia")).toHaveAttribute("data-phase", "reveal", { timeout: 3000 });
  await expect(vic.page.getByTestId("trivia-option").nth(0)).toContainText("Olga Owner");
  await expect(olga.page.getByTestId("trivia-option").nth(1)).toContainText("Vic Visitor");
  await vic.page.screenshot({ path: `${SHOTS}/phone-trivia-reveal.png` });

  await vic.context.close();
  await olga.context.close();
});
