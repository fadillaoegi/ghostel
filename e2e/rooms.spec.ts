import { expect, test, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";

const SHOTS = "docs/evidence/screenshots";
const PASSWORD = "boo-2026!";

const PHONE: BrowserContextOptions = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};

async function checkIn(browser: Browser, name: string, options: BrowserContextOptions = {}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: /Check in/ }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Live");
  return { context, page };
}

const chatInput = (page: Page) => page.getByRole("textbox", { name: "Message" });

async function say(page: Page, text: string) {
  await chatInput(page).fill(text);
  await chatInput(page).press("Enter");
}

async function ride(page: Page, label: RegExp) {
  await page.getByRole("button", { name: "Elevator", exact: true }).click();
  await page.getByRole("button", { name: label }).click();
}

/** Holds a movement key for `ms` (WALK_SPEED is 4 units per second). */
async function walk(page: Page, key: string, ms: number) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

/**
 * Holds a movement key until the door prompt shows `code`. Walking by time alone is flaky on a busy
 * machine: slow frames are clamped (dt ≤ 0.1 s), so the character covers less ground.
 */
async function walkToDoor(page: Page, key: string, code: string, maxMs = 12_000) {
  const prompt = page.getByTestId("door-prompt");
  await page.keyboard.down(key);
  const started = Date.now();
  try {
    while (Date.now() - started < maxMs) {
      if ((await prompt.getAttribute("data-door", { timeout: 50 }).catch(() => null)) === code) return;
      await page.waitForTimeout(40);
    }
  } finally {
    await page.keyboard.up(key);
  }
}

test("password room behind door 2B: create, unlock, isolated chat, door prompt, lock, leave, delete", async ({ browser }) => {
  const olga = await checkIn(browser, "Olga Owner");
  const vic = await checkIn(browser, "Vic Visitor");
  const larry = await checkIn(browser, "Larry Lobby");

  // Olga books door 2B for a password-protected library and walks straight in.
  await olga.page.getByRole("button", { name: "Rooms" }).click();
  await expect(olga.page.getByTestId("room-directory")).toBeVisible();
  await olga.page.getByRole("button", { name: /Create a room/ }).click();
  await olga.page.getByRole("radio", { name: /2F · Portraits/ }).click();
  await olga.page.getByRole("radio", { name: "Door 2B", exact: true }).click();
  await olga.page.getByLabel("Room name").fill("Witching Hour");
  await olga.page.getByRole("radio", { name: "📚 Haunted library" }).click();
  await olga.page.getByRole("radio", { name: "🔑 Password" }).click();
  await olga.page.getByLabel("Room password").fill(PASSWORD);
  await olga.page.getByRole("button", { name: "Open the room" }).click();
  await expect(olga.page.getByTestId("place-name")).toHaveText("🔑 2B · Witching Hour");
  await expect(olga.page.getByTestId("guest-count")).toHaveText("1 guest here");
  await expect(larry.page.getByTestId("guest-count")).toHaveText("2 guests haunting");

  // Vic tries a wrong password first.
  await vic.page.getByRole("button", { name: "Rooms" }).click();
  const card = vic.page.getByTestId("room-card").filter({ hasText: "Witching Hour" });
  await expect(card).toContainText("🔑 Password");
  await expect(card).toContainText("by Olga Owner");
  await expect(card).toContainText("2B");
  await card.getByRole("button", { name: "Enter Witching Hour" }).click();
  await vic.page.getByLabel("Password", { exact: true }).fill("pumpkin");
  await vic.page.getByRole("button", { name: "Unlock" }).click();
  await expect(vic.page.getByRole("alert")).toHaveText("Wrong password.");
  await expect(vic.page.getByTestId("place-name")).toHaveText("Grand Lobby");

  await vic.page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await vic.page.getByRole("button", { name: "Unlock" }).click();
  await expect(vic.page.getByTestId("place-name")).toHaveText("🔑 2B · Witching Hour");
  await expect(vic.page.getByTestId("guest-count")).toHaveText("2 guests here");
  await expect(vic.page.getByTestId("nametag").filter({ hasText: "Olga Owner" })).toBeVisible();

  // The password never reaches browser storage.
  const stored = await vic.page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie);
  expect(stored).not.toContain(PASSWORD);

  // Room chat stays in the room.
  await say(olga.page, "The séance begins");
  await expect(vic.page.getByTestId("chat-log")).toContainText("The séance begins");
  await say(larry.page, "Anyone in the lobby?");
  await expect(larry.page.getByTestId("chat-log")).toContainText("Anyone in the lobby?");
  await larry.page.waitForTimeout(800);
  await expect(larry.page.getByTestId("chat-log")).not.toContainText("séance");
  await expect(vic.page.getByTestId("chat-log")).not.toContainText("Anyone in the lobby?");
  await expect(larry.page.getByTestId("nametag")).toHaveCount(0);

  await vic.page.waitForTimeout(600);
  await vic.page.screenshot({ path: `${SHOTS}/desktop-room-library.png` });

  // "Meet me at 2B": Larry rides to floor 2, walks up to the north wall (it stops him) and then east to door 2B (x = -7.5).
  await ride(larry.page, /Floor 2/);
  await expect(larry.page.getByTestId("place-name")).toHaveText("2F · Hall of Portraits");
  await walk(larry.page, "KeyW", 1500);
  await walkToDoor(larry.page, "KeyD", "2B");
  const prompt = larry.page.getByTestId("door-prompt");
  await expect(prompt).toHaveAttribute("data-door", "2B");
  await expect(prompt).toHaveText("🔑 Press E to enter 2B · Witching Hour");
  await larry.page.waitForTimeout(500);
  await larry.page.screenshot({ path: `${SHOTS}/desktop-door-prompt.png` });
  // E at a password door asks for the password; Back shows the directory with the occupancy.
  await larry.page.keyboard.press("KeyE");
  await expect(larry.page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(larry.page.getByRole("heading", { name: "🔑 Witching Hour" })).toBeVisible();
  await larry.page.getByRole("button", { name: "Back" }).click();
  const larryCard = larry.page.getByTestId("room-card").filter({ hasText: "Witching Hour" });
  await expect(larryCard).toContainText("2/8 inside");
  await larry.page.screenshot({ path: `${SHOTS}/desktop-room-directory.png` });

  // Olga locks the room: Vic stays inside, Larry cannot enter.
  await olga.page.getByRole("button", { name: "Room settings" }).click();
  await olga.page.getByRole("radio", { name: "🔒 Locked" }).click();
  await olga.page.getByRole("button", { name: "Save" }).click();
  await expect(vic.page.getByTestId("place-name")).toHaveText("🔒 2B · Witching Hour");
  await expect(larryCard.getByRole("button", { name: "Enter Witching Hour" })).toBeDisabled({ timeout: 6000 });
  await expect(larryCard.getByRole("button", { name: "Enter Witching Hour" })).toHaveText("Locked");
  await larry.page.getByRole("button", { name: "Close" }).click();
  await expect(prompt).toHaveText("🔒 Press E to enter 2B · Witching Hour");
  await larry.page.keyboard.press("KeyE");
  await expect(larry.page.getByTestId("door-error")).toHaveText("This room is locked by its owner.");

  // Vic leaves the room and steps out in front of door 2B, next to Larry.
  await vic.page.getByRole("button", { name: "Leave room" }).click();
  await expect(vic.page.getByTestId("place-name")).toHaveText("2F · Hall of Portraits");
  await expect(vic.page.getByTestId("door-prompt")).toHaveAttribute("data-door", "2B");
  await expect(larry.page.getByTestId("nametag").filter({ hasText: "Vic Visitor" })).toBeVisible();

  // Deleting the room sends the owner out through the door too, with a notice, and the door is vacant again.
  await olga.page.getByRole("button", { name: "Room settings" }).click();
  await olga.page.getByRole("button", { name: /Delete room/ }).click();
  await olga.page.getByRole("button", { name: "Really delete?" }).click();
  await expect(olga.page.getByTestId("place-name")).toHaveText("2F · Hall of Portraits");
  await expect(olga.page.getByTestId("info")).toHaveText("The owner closed this room. Back to the hall!");
  await expect(prompt).toHaveText("🚪 Press E to book room 2B");

  for (const g of [olga, vic, larry]) await g.context.close();
});

test("phone: create an open ballroom and walk around inside", async ({ browser }) => {
  const phone = await checkIn(browser, "Mina Mummy", PHONE);
  await phone.page.getByRole("button", { name: "Rooms" }).click();
  await phone.page.getByRole("button", { name: /Create a room/ }).click();
  await phone.page.getByLabel("Room name").fill("Pumpkin Ballroom");
  await phone.page.getByRole("radio", { name: "🕯️ Ballroom" }).click();
  await phone.page.screenshot({ path: `${SHOTS}/phone-create-room.png` });
  await phone.page.getByRole("button", { name: "Open the room" }).click();
  await expect(phone.page.getByTestId("place-name")).toHaveText(/^🔓 [123][A-F] · Pumpkin Ballroom$/);

  const friend = await checkIn(browser, "Desk Friend");
  await friend.page.getByRole("button", { name: "Rooms" }).click();
  await friend.page.getByRole("button", { name: "Enter Pumpkin Ballroom" }).click();
  await expect(friend.page.getByTestId("place-name")).toHaveText(/^🔓 [123][A-F] · Pumpkin Ballroom$/);
  await expect(phone.page.getByTestId("nametag").filter({ hasText: "Desk Friend" })).toBeVisible();

  await phone.page.waitForTimeout(900);
  await phone.page.screenshot({ path: `${SHOTS}/phone-room-ballroom.png` });
  await friend.page.screenshot({ path: `${SHOTS}/desktop-room-ballroom.png` });

  await friend.context.close();
  await phone.context.close();
});

test("doors on floor 3: book a vacant door with E, a friend finds it by its code", async ({ browser }) => {
  const bea = await checkIn(browser, "Bea Booker");
  const finn = await checkIn(browser, "Finn Friend");

  // Bea steps out of the greenhouse elevator (x = 0) and walks west to door 3B (x = -4.5).
  for (const g of [bea, finn]) {
    await ride(g.page, /Floor 3/);
    await expect(g.page.getByTestId("place-name")).toHaveText("3F · Moonlit Greenhouse");
  }
  await walk(bea.page, "KeyW", 800);
  await walkToDoor(bea.page, "KeyA", "3B");
  const beaPrompt = bea.page.getByTestId("door-prompt");
  await expect(beaPrompt).toHaveAttribute("data-door", "3B");
  await expect(beaPrompt).toHaveText("🚪 Press E to book room 3B");
  await bea.page.waitForTimeout(500);
  await bea.page.screenshot({ path: `${SHOTS}/desktop-floor3-doors.png` });

  // E on a vacant door opens the create form with that door picked.
  await bea.page.keyboard.press("KeyE");
  await expect(bea.page.getByRole("heading", { name: "✨ New room · door 3B" })).toBeVisible();
  await expect(bea.page.getByRole("radio", { name: "Door 3B", exact: true })).toHaveAttribute("aria-checked", "true");
  await bea.page.getByLabel("Room name").fill("Greenhouse Gang");
  await bea.page.getByRole("button", { name: "Open the room" }).click();
  await expect(bea.page.getByTestId("place-name")).toHaveText("🔓 3B · Greenhouse Gang");

  // Finn walks to the same door: its label updated live, and E walks straight in.
  await walk(finn.page, "KeyW", 800);
  await walkToDoor(finn.page, "KeyA", "3B");
  const finnPrompt = finn.page.getByTestId("door-prompt");
  await expect(finnPrompt).toHaveText("🔓 Press E to enter 3B · Greenhouse Gang");
  await finn.page.waitForTimeout(500);
  await finn.page.screenshot({ path: `${SHOTS}/desktop-door-occupied.png` });
  await finn.page.keyboard.press("KeyE");
  await expect(finn.page.getByTestId("place-name")).toHaveText("🔓 3B · Greenhouse Gang");
  await expect(bea.page.getByTestId("nametag").filter({ hasText: "Finn Friend" })).toBeVisible();

  // Leaving puts Finn back in the greenhouse, in front of door 3B.
  await finn.page.getByRole("button", { name: "Leave room" }).click();
  await expect(finn.page.getByTestId("place-name")).toHaveText("3F · Moonlit Greenhouse");
  await expect(finnPrompt).toHaveAttribute("data-door", "3B");

  // A taken door cannot be booked twice: the directory marks it taken.
  await finn.page.getByRole("button", { name: "Rooms" }).click();
  await finn.page.getByRole("button", { name: /Create a room/ }).click();
  await expect(finn.page.getByRole("radio", { name: /3F · Greenhouse/ })).toHaveAttribute("aria-checked", "true");
  await expect(finn.page.getByRole("radio", { name: "Door 3B (taken)" })).toBeDisabled();

  await finn.context.close();
  await bea.context.close();
});
