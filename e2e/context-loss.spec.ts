import { expect, test, type Page } from "@playwright/test";

// M24: Android Chrome can drop a page's WebGL context (app in the background, memory pressure). The 3D view
// then stays blank while the HUD keeps working. WEBGL_lose_context simulates that here.

const SHOTS = "docs/evidence/screenshots";

/** Mean luma (0–255) of the middle of the screen, where the 3D scene is, and its spread (a flat colour has ~0). */
async function sceneLuma(page: Page): Promise<{ mean: number; spread: number }> {
  const box = page.viewportSize() ?? { width: 1366, height: 820 };
  const png = await page.screenshot({ clip: { x: box.width * 0.3, y: box.height * 0.25, width: box.width * 0.4, height: box.height * 0.4 } });
  const probe = await page.context().newPage();
  const result = await probe.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d") as CanvasRenderingContext2D;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let sum = 0;
    let sq = 0;
    const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) {
      const y = 0.2126 * (d[i] ?? 0) + 0.7152 * (d[i + 1] ?? 0) + 0.0722 * (d[i + 2] ?? 0);
      sum += y;
      sq += y * y;
    }
    const mean = sum / n;
    return { mean, spread: Math.sqrt(Math.max(0, sq / n - mean * mean)) };
  }, `data:image/png;base64,${png.toString("base64")}`);
  await probe.close();
  return result;
}

/** Loses the WebGL context of the 3D canvas, like the GPU process dropping it. Returns false if no context. */
function loseContext(page: Page, restore: boolean) {
  return page.evaluate((restoreLater) => {
    const canvas = document.querySelector(".lobby-canvas canvas") as HTMLCanvasElement | null;
    const gl = (canvas?.getContext("webgl2") ?? canvas?.getContext("webgl")) as WebGL2RenderingContext | null;
    const ext = gl?.getExtension("WEBGL_lose_context");
    if (!ext) return false;
    ext.loseContext();
    if (restoreLater) setTimeout(() => ext.restoreContext(), 300);
    return true;
  }, restore);
}

test("the 3D view comes back after the WebGL context is lost", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Your name").fill("Lost Lights");
  await page.getByRole("button", { name: /Check in/ }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Live");
  await page.waitForTimeout(1500);
  const before = await sceneLuma(page);
  console.log("before", before);
  expect(before.spread).toBeGreaterThan(4);

  // 1. Lost and never restored by the browser (the case in the owner's screenshot).
  expect(await loseContext(page, false)).toBe(true);
  await page.waitForTimeout(400);
  const lost = await sceneLuma(page);
  console.log("lost", lost);
  await page.screenshot({ path: `${SHOTS}/desktop-context-lost.png` });
  await expect(page.getByTestId("scene-recovering")).toBeVisible();
  await expect(page.getByTestId("scene-recovering")).toHaveCount(0, { timeout: 15_000 });
  await page.waitForTimeout(1500);
  const recovered = await sceneLuma(page);
  console.log("recovered (new canvas)", recovered);
  expect(recovered.spread).toBeGreaterThan(4);
  expect(Math.abs(recovered.mean - before.mean)).toBeLessThan(25);
  // The guest stayed in the lobby the whole time: no reload, same connection.
  await expect(page.getByTestId("connection-status")).toHaveText("Live");

  // 2. Lost and restored by the browser.
  expect(await loseContext(page, true)).toBe(true);
  await page.waitForTimeout(2500);
  const restored = await sceneLuma(page);
  console.log("restored (same canvas)", restored);
  expect(restored.spread).toBeGreaterThan(4);
  await page.screenshot({ path: `${SHOTS}/desktop-context-restored.png` });
  await context.close();
});
