import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { OUT, typeSlowly, walkToPrompt } from "./helpers";
import { startRecording } from "./record";

// Footage for the demo video: the Night Desk (M16), Ghostel's Resurrection echo. A 1987 green-screen terminal in
// the Grand Lobby with an original text adventure (VT323 phosphor font, scanlines). `WHO` lists live guests.

test("Resurrection: the Night Desk terminal", async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Your name").fill("Night Clerk");
  await page.getByRole("button", { name: /Check in/ }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Live");
  // Start at the elevator, like the E2E test: the desk is west of it under the window.
  await page.getByRole("button", { name: "Elevator", exact: true }).click();
  await page.getByRole("button", { name: /Floor 2/ }).click();
  await expect(page.getByTestId("place-name")).toHaveText("2F · Hall of Portraits");
  await page.getByRole("button", { name: "Elevator", exact: true }).click();
  await page.getByRole("button", { name: /Floor 1/ }).click();
  await expect(page.getByTestId("place-name")).toHaveText("Grand Lobby");
  await page.waitForTimeout(2500);

  const stop = await startRecording(page, "resurrection");
  await page.waitForTimeout(1500);

  // 1. Walk over to the Night Desk.
  await walkToPrompt(page, "KeyA", "terminal");
  await page.waitForTimeout(1500);

  // 2. Log in: the CRT boots.
  await page.keyboard.press("KeyE");
  const terminal = page.getByTestId("night-desk");
  const log = page.getByTestId("night-desk-log");
  await expect(terminal).toBeVisible();
  await expect(log).toContainText("ONE GUEST NEVER CHECKED OUT.");
  await page.waitForTimeout(3500);

  const command = page.getByRole("textbox", { name: "Command" });
  const send = async (text: string, pause = 1700) => {
    await command.focus();
    await typeSlowly(page, text);
    await page.waitForTimeout(250);
    await command.press("Enter");
    await page.waitForTimeout(pause);
  };

  // 3. The terminal knows the live hotel.
  await send("who", 2500);
  await expect(log).toContainText("NIGHT CLERK");
  await send("rooms", 2500);

  // 4. Play the adventure to the end.
  await send("look", 2200);
  for (const c of ["n", "take ledger", "s", "ring bell", "e", "n", "search sheets", "s", "open door", "e"]) await send(c);
  await send("sign ledger", 1000);
  await expect(log).toContainText("*** CHECKOUT COMPLETE ***");
  await page.waitForTimeout(4500);

  // 5. Log out and step back into the 3D lobby.
  await page.keyboard.press("Escape");
  await expect(terminal).toHaveCount(0);
  await page.waitForTimeout(2500);

  const file = `${OUT}/resurrection-night-desk.mp4`;
  const result = await stop(file);
  console.log(`footage: ${file}, ${result.frames} frames over ${result.seconds.toFixed(1)} s`);
  await context.close();
});
