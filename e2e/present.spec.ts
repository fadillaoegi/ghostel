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

/** A small, valid PDF with one line of text per page (built here, so no binary fixture is needed). */
function makePdf(pages: string[]): Buffer {
  const objs: string[] = ["<< /Type /Catalog /Pages 2 0 R >>"];
  const font = 3 + pages.length * 2;
  objs.push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  pages.forEach((text, i) => {
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 225] /Contents ${4 + i * 2} 0 R /Resources << /Font << /F1 ${font} 0 R >> >> >>`);
    const stream = `BT /F1 30 Tf 30 110 Td (${text}) Tj ET`;
    objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
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

async function openRoom(page: Page, name: string) {
  await page.getByRole("button", { name: "Rooms" }).click();
  await page.getByRole("button", { name: /Create a room/ }).click();
  await page.getByLabel("Room name").fill(name);
  await page.getByRole("radio", { name: "💬 Just hang out" }).click();
  await page.getByRole("button", { name: "Open the room" }).click();
  await expect(page.getByTestId("place-name")).toHaveText(new RegExp(`${name}$`));
}

/** A room's meeting is its long table (M20): walk up to it, sideways if that chair is taken, and sit. */
async function sitAtLongTable(page: Page) {
  await page.bringToFront();
  // Long limits: with a screen share running, frames can be slow on a busy test machine.
  if (!(await holdUntilSeat(page, "KeyW", 10_000))) {
    if (!(await holdUntilSeat(page, "KeyD", 8000))) expect(await holdUntilSeat(page, "KeyA", 12_000)).toBe(true);
  }
  await page.keyboard.press("KeyE");
  await expect(page.getByTestId("meeting")).toBeVisible();
}

test("a guest asks to show PDF slides, the owner allows it, everyone at the table follows the pages", async ({ browser }) => {
  const olga = await checkIn(browser, "Olga Owner");
  const vic = await checkIn(browser, "Vic Visitor");
  await openRoom(olga.page, "Board Meeting");
  await vic.page.getByRole("button", { name: "Rooms" }).click();
  await vic.page.getByRole("button", { name: "Enter Board Meeting" }).click();
  await expect(vic.page.getByTestId("place-name")).toHaveText(/Board Meeting$/);

  // Standing, Vic cannot ask to present (M20); at the table he can.
  await expect(vic.page.getByRole("button", { name: "Ask to present" })).toHaveCount(0);
  await sitAtLongTable(olga.page);
  await sitAtLongTable(vic.page);

  await vic.page.getByRole("button", { name: "Ask to present" }).click();
  await vic.page.getByRole("menuitem", { name: /Show PDF slides/ }).click();
  await expect(vic.page.getByTestId("info")).toHaveText("Asked the room's owner to let you present. Wait for a yes!");
  const request = olga.page.getByTestId("present-request");
  await expect(request).toHaveText(/Vic Visitor wants to show PDF slides\./);
  await olga.page.screenshot({ path: `${SHOTS}/desktop-present-request.png` });
  await request.getByRole("button", { name: "Allow" }).click();
  await expect(olga.page.getByTestId("present-requests")).toHaveCount(0);

  await vic.page.getByTestId("slides-input").setInputFiles({ name: "deck.pdf", mimeType: "application/pdf", buffer: makePdf(["Hello from Ghostel", "Thank you!"]) });
  for (const g of [olga, vic]) {
    await expect(g.page.getByTestId("slides")).toHaveAttribute("data-rendered", "yes", { timeout: 20_000 });
    await expect(g.page.getByTestId("slide-number")).toHaveText("1 / 2");
  }
  await vic.page.getByRole("button", { name: "Next slide" }).click();
  await expect(olga.page.getByTestId("slide-number")).toHaveText("2 / 2");
  await expect(olga.page.getByTestId("slides")).toHaveAttribute("data-page", "2");
  await olga.page.waitForTimeout(900);
  await olga.page.screenshot({ path: `${SHOTS}/desktop-present-slides.png` });

  // The owner can end it; the slides disappear for everyone.
  await olga.page.getByRole("button", { name: "Stop presenting" }).click();
  await expect(vic.page.getByTestId("slides")).toHaveCount(0);
  await expect(olga.page.getByTestId("slides")).toHaveCount(0);

  await vic.context.close();
  await olga.context.close();
});

test("the owner shares a screen at the table; a seated guest sees it live; standing up ends it", async ({ browser }) => {
  const olga = await checkIn(browser, "Olga Owner");
  const vic = await checkIn(browser, "Vic Visitor");
  await openRoom(olga.page, "Screen Night");
  await vic.page.getByRole("button", { name: "Rooms" }).click();
  await vic.page.getByRole("button", { name: "Enter Screen Night" }).click();
  await expect(vic.page.getByTestId("place-name")).toHaveText(/Screen Night$/);
  await sitAtLongTable(olga.page);
  await sitAtLongTable(vic.page);

  await olga.page.bringToFront();
  await olga.page.getByRole("button", { name: "Present" }).click();
  await olga.page.getByRole("menuitem", { name: /Share my screen/ }).click();
  await olga.page.getByRole("button", { name: "Share your screen" }).click();
  await expect(olga.page.getByTestId("shared-screen")).toHaveAttribute("data-live", "yes", { timeout: 15_000 });
  const screen = vic.page.getByTestId("meeting").getByTestId("shared-screen");
  await expect(screen).toHaveAttribute("data-live", "yes", { timeout: 20_000 });
  await expect.poll(() => screen.locator("video").evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 20_000 }).toBeGreaterThan(0);
  await vic.page.waitForTimeout(900);
  await vic.page.screenshot({ path: `${SHOTS}/desktop-present-screen.png` });

  // Folding the meeting to see the hotel keeps a small live stage (the room's TV copies it).
  await vic.page.getByRole("button", { name: "Show the hotel" }).click();
  await expect(vic.page.getByTestId("meeting")).toHaveClass(/meeting--folded/);
  const video = screen.locator("video");
  const t0 = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 10_000 }).toBeGreaterThan(t0);
  await vic.page.waitForTimeout(900);
  await vic.page.screenshot({ path: `${SHOTS}/desktop-present-folded.png` });
  await vic.page.getByRole("button", { name: "Show meeting" }).click();
  await expect(vic.page.getByTestId("meeting")).not.toHaveClass(/meeting--folded/);

  // With the camera on, the tiles under the stage keep the camera's 4:3 shape (not squashed into a flat strip).
  await vic.page.bringToFront();
  await vic.page.getByRole("button", { name: "Turn camera on" }).click();
  const ownTile = vic.page.getByTestId("meeting-tile").filter({ hasText: "(you)" });
  await expect(ownTile).toHaveAttribute("data-cam", "on");
  for (const tile of await vic.page.getByTestId("meeting-tile").all()) {
    const box = (await tile.boundingBox())!;
    expect(box.width / box.height).toBeGreaterThan(1.28);
    expect(box.width / box.height).toBeLessThan(1.39);
  }
  expect(await ownTile.locator("video").evaluate((v) => getComputedStyle(v).objectFit)).toBe("cover");
  await vic.page.waitForTimeout(900);
  await vic.page.screenshot({ path: `${SHOTS}/desktop-present-meeting-camera.png` });

  // The presenter stands up: she leaves the meeting, so her presentation ends for everyone (M20).
  await olga.page.getByRole("button", { name: "Stand up" }).click();
  await expect(olga.page.getByTestId("meeting-hint")).toBeVisible();
  await expect(vic.page.getByTestId("shared-screen")).toHaveCount(0);
  await expect(vic.page.getByTestId("meeting-count")).toHaveText("1 person");
  await vic.context.close();
  await olga.context.close();
});
