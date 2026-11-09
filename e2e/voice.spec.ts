import { expect, test, type Browser, type Page } from "@playwright/test";

const SHOTS = "docs/evidence/screenshots";

async function checkIn(browser: Browser, name: string) {
  const context = await browser.newContext({ permissions: ["microphone", "camera"] });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: /Check in/ }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Live");
  return { context, page };
}

/** Holds `key` until a free-seat prompt shows; returns false if none appeared in time. */
async function holdUntilSeat(page: Page, key: string, maxMs: number): Promise<boolean> {
  const prompt = page.getByTestId("door-prompt");
  await page.keyboard.down(key);
  const started = Date.now();
  try {
    while (Date.now() - started < maxMs) {
      if ((await prompt.getAttribute("data-prompt", { timeout: 50 }).catch(() => null)) === "seat") return true;
      await page.waitForTimeout(40);
    }
    return false;
  } finally {
    await page.keyboard.up(key);
  }
}

/** From a room's entrance: walk up to the long table, sideways if that chair is taken, and sit. */
async function sitAtLongTable(page: Page) {
  if (!(await holdUntilSeat(page, "KeyW", 4000))) {
    if (!(await holdUntilSeat(page, "KeyD", 3000))) expect(await holdUntilSeat(page, "KeyA", 5000)).toBe(true);
  }
  await page.keyboard.press("KeyE");
  await expect(page.getByTestId("meeting")).toBeVisible();
}

async function openRoom(page: Page, name: string) {
  await page.getByRole("button", { name: "Rooms" }).click();
  await page.getByRole("button", { name: /Create a room/ }).click();
  await page.getByLabel("Room name").fill(name);
  await page.getByRole("radio", { name: "💬 Just hang out" }).click();
  await page.getByRole("button", { name: "Open the room" }).click();
  await expect(page.getByTestId("place-name")).toHaveText(new RegExp(`^🔓 [123][A-F] · ${name}$`));
}

test("a room is one call: microphone and camera only after a click, the meeting view when seated", async ({ browser }) => {
  const olga = await checkIn(browser, "Olga Owner");
  const vic = await checkIn(browser, "Vic Visitor");

  // No call in the lobby until you sit at a table.
  await expect(olga.page.getByTestId("call-bar")).toHaveCount(0);

  await openRoom(olga.page, "Seance Circle");
  await vic.page.getByRole("button", { name: "Rooms" }).click();
  await vic.page.getByRole("button", { name: "Enter Seance Circle" }).click();
  await expect(vic.page.getByTestId("place-name")).toHaveText(/Seance Circle$/);

  // Everyone in the room is in the call, muted until they choose otherwise.
  await expect(olga.page.getByTestId("voice-status")).toContainText("2 in call");
  await expect(vic.page.getByTestId("nametag").filter({ hasText: "Olga Owner" })).toHaveAttribute("data-voice", "muted");

  // Chrome holds getUserMedia until the page has focus (real users click on a focused page).
  await olga.page.bringToFront();
  await olga.page.getByRole("button", { name: "Unmute" }).click();
  await expect(olga.page.getByRole("button", { name: "Mute" })).toBeVisible();
  await vic.page.bringToFront();
  await vic.page.getByRole("button", { name: "Unmute" }).click();
  await expect(vic.page.getByTestId("voice-status")).toContainText("1 connected", { timeout: 20_000 });
  await expect(olga.page.getByTestId("voice-status")).toContainText("1 connected", { timeout: 20_000 });

  // Audio really flows: the fake microphone's beep is measured on the receiving side.
  await expect(vic.page.getByTestId("nametag").filter({ hasText: "Olga Owner" })).toHaveAttribute("data-voice", "speaking", { timeout: 20_000 });
  await expect(olga.page.getByTestId("nametag").filter({ hasText: "Vic Visitor" })).toHaveAttribute("data-voice", "speaking", { timeout: 20_000 });

  // Mute is shown to the other guest.
  await olga.page.bringToFront();
  await olga.page.getByRole("button", { name: "Mute" }).click();
  await expect(vic.page.getByTestId("nametag").filter({ hasText: "Olga Owner" })).toHaveAttribute("data-voice", "muted");

  // Both take a seat at the long table: the meeting view opens with one tile per person.
  await sitAtLongTable(olga.page);
  await vic.page.bringToFront();
  await sitAtLongTable(vic.page);
  for (const g of [olga, vic]) {
    await expect(g.page.getByTestId("meeting-count")).toHaveText("2 people");
    await expect(g.page.getByTestId("meeting-tile")).toHaveCount(2);
  }

  // Vic turns the camera on (Chromium's fake camera): Olga's tile for Vic shows video.
  await vic.page.getByRole("button", { name: "Turn camera on" }).click();
  await expect(vic.page.getByRole("button", { name: "Turn camera off" })).toBeVisible();
  const vicTile = olga.page.getByTestId("meeting-tile").filter({ hasText: "Vic Visitor" });
  await expect(vicTile).toHaveAttribute("data-cam", "on", { timeout: 20_000 });
  await expect
    .poll(() => vicTile.locator("video").evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 20_000 })
    .toBeGreaterThan(0);
  await olga.page.waitForTimeout(800);
  await olga.page.screenshot({ path: `${SHOTS}/desktop-meeting-room.png` });

  // Standing up closes the meeting view; the camera stops when Vic leaves the room.
  await vic.page.getByRole("button", { name: "Stand up" }).click();
  await expect(vic.page.getByTestId("meeting")).toHaveCount(0);
  await expect(vic.page.getByTestId("call-bar")).toBeVisible();
  await vic.page.getByRole("button", { name: "Leave room" }).click();
  await expect(vic.page.getByTestId("place-name")).toHaveText(/^(Grand Lobby|[23]F · .+)$/);
  await expect(olga.page.getByTestId("meeting-count")).toHaveText("1 person");
  await expect(vicTile).toHaveCount(0);
  expect(await vic.page.locator("audio[data-voice-peer]").count()).toBe(0);
  const vicTracks = await vic.page.evaluate(() => document.querySelectorAll("video").length);
  expect(vicTracks).toBe(0);

  await vic.context.close();
  await olga.context.close();
});

test("tables in Ghoul's Diner: sit down for a table call, stand up to leave it", async ({ browser }) => {
  const dot = await checkIn(browser, "Diner Dot");
  const pat = await checkIn(browser, "Passing Pat");
  for (const g of [dot, pat]) {
    await g.page.getByRole("button", { name: "Elevator", exact: true }).click();
    await g.page.getByRole("button", { name: /Floor 4/ }).click();
    await expect(g.page.getByTestId("place-name")).toHaveText("4F · Ghoul's Diner");
  }
  // From the elevator, south along the west aisle to the first table's chair.
  expect(await holdUntilSeat(dot.page, "KeyS", 8000)).toBe(true);
  await expect(dot.page.getByTestId("door-prompt")).toHaveText("🪑 Press E to sit down");
  await dot.page.keyboard.press("KeyE");
  await expect(dot.page.getByTestId("meeting")).toBeVisible();
  await expect(dot.page.getByTestId("meeting")).toContainText(/Table \d+ · Ghoul's Diner/);
  await expect(dot.page.getByTestId("meeting-count")).toHaveText("1 person");
  // Pat, standing in the aisle, is not part of the table's call.
  await expect(pat.page.getByTestId("meeting")).toHaveCount(0);
  await expect(pat.page.getByTestId("call-bar")).toHaveCount(0);
  await dot.page.waitForTimeout(800);
  await dot.page.screenshot({ path: `${SHOTS}/desktop-meeting-table.png` });

  // Walking (or E) stands you up.
  await dot.page.keyboard.press("KeyE");
  await expect(dot.page.getByTestId("meeting")).toHaveCount(0);
  await expect(dot.page.getByTestId("door-prompt")).toHaveAttribute("data-prompt", "seat");

  await pat.context.close();
  await dot.context.close();
});
