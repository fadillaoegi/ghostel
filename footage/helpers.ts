import type { Page } from "@playwright/test";

export const OUT = "submission/footage";

/** Holds a key until the prompt of `kind` shows (frame times vary, so fixed-time walks are unreliable). */
export async function walkToPrompt(page: Page, key: string, kind: string, maxMs = 30_000) {
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

export async function hold(page: Page, key: string, ms: number) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

/** Types like a person, so the viewer can read along. */
export async function typeSlowly(page: Page, text: string, delay = 85) {
  await page.keyboard.type(text, { delay });
}
