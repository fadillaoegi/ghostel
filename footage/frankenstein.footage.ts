import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { startRecording } from "./record";

// Footage for the demo video: the Haunted Mirror (M16), Ghostel's Frankenstein echo. The guest's own camera is
// stitched into the 3D hotel through a custom shader, and stays on the device.
// Run with `pnpm footage` (see submission/README.md). The camera is FOOTAGE_CAMERA (.y4m) or Chrome's test pattern.

const OUT = "submission/footage";

async function walkToPrompt(page: Page, key: string, kind: string, maxMs = 30_000) {
  const prompt = page.getByTestId("door-prompt");
  await page.keyboard.down(key);
  const started = Date.now();
  try {
    while (Date.now() - started < maxMs) {
      if ((await prompt.getAttribute("data-prompt", { timeout: 50 }).catch(() => null)) === kind) return;
      await page.waitForTimeout(40);
    }
    throw new Error(`No ${kind} prompt within ${maxMs} ms`);
  } finally {
    await page.keyboard.up(key);
  }
}

async function hold(page: Page, key: string, ms: number) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

test("Frankenstein: the Haunted Mirror", async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  const context = await browser.newContext({ permissions: ["camera"] });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByLabel("Your name")).toBeVisible();
  await page.waitForTimeout(1500);
  const stop = await startRecording(page, "frankenstein");

  // 1. Check in as Victor, with the Frankenstein head.
  await page.waitForTimeout(1200);
  await page.getByLabel("Your name").pressSequentially("Victor", { delay: 110 });
  await page.waitForTimeout(500);
  await page.getByRole("radio", { name: "🔩 Frankenstein", exact: true }).click();
  await page.waitForTimeout(1800);
  await page.getByRole("button", { name: /Check in/ }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Live");
  await page.waitForTimeout(3000);

  // 2. Up to the Hall of Portraits.
  await page.getByRole("button", { name: "Elevator", exact: true }).click();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: /Floor 2/ }).click();
  await expect(page.getByTestId("place-name")).toHaveText("2F · Hall of Portraits");
  await page.waitForTimeout(2500);

  // 3. Down the gallery to the Mirror of Costumes.
  await walkToPrompt(page, "KeyD", "mirror");
  await page.waitForTimeout(1500);

  // 4. Look into the mirror: the camera turns into a ghostly reflection.
  const mirror = page.getByTestId("mirror-cam");
  await page.bringToFront();
  await mirror.click();
  await expect(mirror).toHaveAttribute("data-cam", "on");
  await page.waitForTimeout(4500);
  await hold(page, "KeyA", 350);
  await page.waitForTimeout(800);
  await hold(page, "KeyD", 350);
  await page.waitForTimeout(4500);

  // 5. One click and the camera is off again (it never leaves the device).
  await mirror.click();
  await expect(mirror).toHaveAttribute("data-cam", "off");
  await page.waitForTimeout(1800);
  await hold(page, "KeyA", 1500);
  await page.waitForTimeout(1200);

  const file = `${OUT}/frankenstein-haunted-mirror.mp4`;
  const result = await stop(file);
  console.log(`footage: ${file}, ${result.frames} frames over ${result.seconds.toFixed(1)} s`);
  await context.close();
});
