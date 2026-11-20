import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { OUT } from "./helpers";
import { startRecording } from "./record";

// Footage for the demo video: a short walk through each of the five floors (WALK_SPEED is 4 units per second).
// Routes are planned around the obstacles in packages/shared (layout.ts, floors.ts, tables.ts); the server slides
// the guest along anything it touches, so a small bump never stops the walk.

type Step = { keys: string[]; ms: number } | { pause: number };
const go = (keys: string, ms: number): Step => ({ keys: keys.split("+"), ms });
const pause = (ms: number): Step => ({ pause: ms });

async function walk(page: Page, steps: Step[]) {
  for (const s of steps) {
    if ("pause" in s) {
      await page.waitForTimeout(s.pause);
      continue;
    }
    for (const k of s.keys) await page.keyboard.down(k);
    await page.waitForTimeout(s.ms);
    for (const k of s.keys) await page.keyboard.up(k);
  }
}

const FLOORS: { floor: number; file: string; label: RegExp | null; place: string; guest: string; route: Step[] }[] = [
  {
    floor: 1,
    file: "floor-1-grand-lobby",
    label: null,
    place: "Grand Lobby",
    guest: "Lobby Lurker",
    // From the front doors: up past the fountain, round the reception, down the west side and back to the middle.
    route: [pause(1800), go("KeyW", 1400), go("KeyD", 1500), go("KeyW", 1500), pause(1500), go("KeyA", 3000), pause(1200), go("KeyS", 2800), go("KeyD", 1500), pause(2000)],
  },
  {
    floor: 2,
    file: "floor-2-hall-of-portraits",
    label: /Floor 2/,
    place: "2F · Hall of Portraits",
    guest: "Gallery Ghoul",
    // The whole gallery from the elevator (west) to the Mirror of Costumes (east), past the watching portraits.
    route: [pause(1800), go("KeyD", 3200), pause(1500), go("KeyD", 2800), pause(1500), go("KeyD", 2600), go("KeyW", 400), pause(2200)],
  },
  {
    floor: 3,
    file: "floor-3-moonlit-greenhouse",
    label: /Floor 3/,
    place: "3F · Moonlit Greenhouse",
    guest: "Petal Phantom",
    // A loop around the bubbling cauldron, past the giant pumpkins that light up as you pass.
    route: [pause(1800), go("KeyD", 1500), go("KeyS", 3000), pause(1200), go("KeyA", 3000), pause(1200), go("KeyW", 3000), pause(1200), go("KeyD", 1500), pause(1800)],
  },
  {
    floor: 4,
    file: "floor-4-ghouls-diner",
    label: /Floor 4/,
    place: "4F · Ghoul's Diner",
    guest: "Hungry Haunt",
    // Along the food counter (skeleton cook), then down between the tables and across the dining room.
    route: [pause(1800), go("KeyD", 1800), go("KeyS", 750), go("KeyD", 3500), pause(1800), go("KeyA", 600), go("KeyS", 3000), pause(1000), go("KeyA", 3400), pause(1800)],
  },
  {
    floor: 5,
    file: "floor-5-rooftop-graveyard",
    label: /Floor 5/,
    place: "5F · Rooftop Graveyard",
    guest: "Moon Watcher",
    // To the edge above the night city, along it, then past the telescope and the water tower.
    route: [pause(1800), go("KeyS", 4500), pause(1500), go("KeyD", 3000), pause(1800), go("KeyW", 3000), go("KeyA", 3000), pause(1000), go("KeyA", 2000), pause(1000), go("KeyS", 1000), pause(1800)],
  },
];

for (const f of FLOORS) {
  test(`Floor ${f.floor}: ${f.place}`, async ({ browser }) => {
    mkdirSync(OUT, { recursive: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/");
    await page.getByLabel("Your name").fill(f.guest);
    await page.getByRole("button", { name: /Check in/ }).click();
    await expect(page.getByTestId("connection-status")).toHaveText("Live");
    await page.waitForTimeout(2500);
    let stop: Awaited<ReturnType<typeof startRecording>>;
    if (f.label) {
      // The clip starts with the elevator ride, so it opens on the doors and the floor's name.
      stop = await startRecording(page, f.file);
      await page.waitForTimeout(800);
      await page.getByRole("button", { name: "Elevator", exact: true }).click();
      await page.waitForTimeout(900);
      await page.getByRole("button", { name: f.label }).click();
      await expect(page.getByTestId("place-name")).toHaveText(f.place);
    } else {
      await expect(page.getByTestId("place-name")).toHaveText(f.place);
      stop = await startRecording(page, f.file);
    }
    await walk(page, f.route);
    const file = `${OUT}/${f.file}.mp4`;
    const result = await stop(file);
    console.log(`footage: ${file}, ${result.frames} frames over ${result.seconds.toFixed(1)} s`);
    await context.close();
  });
}
