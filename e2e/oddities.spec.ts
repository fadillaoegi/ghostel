import { expect, test, type Browser, type Page } from "@playwright/test";

// M16: the Night Desk terminal (lobby) and the Haunted Mirror (floor 2).
const SHOTS = "docs/evidence/screenshots";

async function checkIn(browser: Browser, name: string) {
  const context = await browser.newContext();
  // Test-only spy: remember every stream the page asks for, to check what the mirror captured and that it stopped.
  await context.addInitScript(() => {
    const w = window as unknown as { __streams: MediaStream[] };
    w.__streams = [];
    const original = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
    if (!original) return;
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const s = await original(constraints);
      w.__streams.push(s);
      return s;
    };
  });
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

const streams = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __streams: MediaStream[] }).__streams.map((s) => ({
      video: s.getVideoTracks().length,
      audio: s.getAudioTracks().length,
      live: s.getTracks().filter((t) => t.readyState === "live").length,
    })),
  );

test("Night Desk: the lobby's 1987 terminal plays a text adventure to the end", async ({ browser }) => {
  const g = await checkIn(browser, "Night Clerk");
  // Step out of the lobby elevator (north wall), then walk west to the desk under the window.
  await ride(g.page, /Floor 2/);
  await expect(g.page.getByTestId("place-name")).toHaveText("2F · Hall of Portraits");
  await ride(g.page, /Floor 1/);
  await expect(g.page.getByTestId("place-name")).toHaveText("Grand Lobby");
  await expect(g.page.getByTestId("door-prompt")).toHaveAttribute("data-prompt", "elevator");
  await walkToPrompt(g.page, "KeyA", "terminal");
  await expect(g.page.getByTestId("door-prompt")).toHaveText("🖥️ Press E to log in to the Night Desk");
  await g.page.waitForTimeout(600);
  await g.page.screenshot({ path: `${SHOTS}/desktop-night-desk-lobby.png` });

  await g.page.keyboard.press("KeyE");
  const terminal = g.page.getByTestId("night-desk");
  const log = g.page.getByTestId("night-desk-log");
  await expect(terminal).toBeVisible();
  await expect(log).toContainText("ONE GUEST NEVER CHECKED OUT.");
  const command = g.page.getByRole("textbox", { name: "Command" });
  await expect(command).toBeFocused();

  const send = async (text: string) => {
    await command.fill(text);
    await command.press("Enter");
  };
  await send("who");
  await expect(log).toContainText("GUESTS IN THE LOBBY: 1");
  await expect(log).toContainText("NIGHT CLERK");
  await send("rooms");
  await expect(log).toContainText("1A  ");
  for (const c of ["n", "take ledger", "s", "ring bell", "e", "n", "search sheets", "s", "open door", "e", "sign ledger"]) await send(c);
  await expect(log).toContainText("*** CHECKOUT COMPLETE ***");
  await expect(log).toContainText("YOU SOLVED THE NIGHT DESK IN 11 MOVES.");
  await g.page.screenshot({ path: `${SHOTS}/desktop-night-desk.png` });

  await terminal.getByRole("button", { name: "LOOK" }).click();
  await expect(log).toContainText("THE BED IS MADE");
  await g.page.keyboard.press("Escape");
  await expect(terminal).toHaveCount(0);
  // Typing N, S, E and W in the terminal did not walk the avatar away from the desk.
  await expect(g.page.getByTestId("door-prompt")).toHaveAttribute("data-prompt", "terminal");
  await g.context.close();
});

test("Haunted Mirror: the camera shows only after a click, stays local and stops when you walk away", async ({ browser }) => {
  const g = await checkIn(browser, "Mirror Mira");
  await ride(g.page, /Floor 2/);
  await expect(g.page.getByTestId("place-name")).toHaveText("2F · Hall of Portraits");
  await walkToPrompt(g.page, "KeyD", "mirror", 25_000);
  const button = g.page.getByTestId("mirror-cam");
  await expect(button).toHaveAttribute("data-cam", "off");
  await expect(button).toContainText("Only you see it");
  // Standing at the mirror alone never asks for the camera.
  expect(await streams(g.page)).toEqual([]);

  await g.page.bringToFront(); // Chrome waits for focus before granting devices.
  await button.click();
  await expect(button).toHaveAttribute("data-cam", "on");
  await expect(button).toHaveAttribute("aria-pressed", "true");
  expect(await streams(g.page)).toEqual([{ video: 1, audio: 0, live: 1 }]);
  await g.page.waitForTimeout(1200);
  await g.page.screenshot({ path: `${SHOTS}/desktop-mirror-camera.png` });

  // Walk away: the button goes and the camera stops.
  await g.page.keyboard.down("KeyA");
  await expect(button).toHaveCount(0);
  await g.page.keyboard.up("KeyA");
  await expect.poll(() => streams(g.page)).toEqual([{ video: 1, audio: 0, live: 0 }]);

  // Back at the mirror, a click turns it on again and a second click off.
  await walkToPrompt(g.page, "KeyD", "mirror");
  await button.click();
  await expect(button).toHaveAttribute("data-cam", "on");
  await button.click();
  await expect(button).toHaveAttribute("data-cam", "off");
  await expect.poll(async () => (await streams(g.page)).map((s) => s.live)).toEqual([0, 0]);
  await g.context.close();
});
