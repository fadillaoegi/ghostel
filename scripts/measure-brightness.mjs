// Mean brightness of screenshots, for comparing lighting changes (M18).
// Usage: node scripts/measure-brightness.mjs docs/evidence/screenshots/a.png [b.png …]
// Prints the mean luma (Rec. 709, 0–255) of the whole image and of its middle 60% × 50% (mostly 3D scene, less HUD).
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { chromium } from "@playwright/test";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node scripts/measure-brightness.mjs <png> [png…]");
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();
console.log("file\twhole\tmiddle");
for (const file of files) {
  const dataUrl = `data:image/png;base64,${readFileSync(file).toString("base64")}`;
  const [whole, middle] = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const mean = (x, y, w, h) => {
      const d = ctx.getImageData(x, y, w, h).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      return sum / (d.length / 4);
    };
    const W = canvas.width;
    const H = canvas.height;
    return [mean(0, 0, W, H), mean(Math.round(W * 0.2), Math.round(H * 0.2), Math.round(W * 0.6), Math.round(H * 0.5))];
  }, dataUrl);
  console.log(`${basename(file)}\t${whole.toFixed(1)}\t${middle.toFixed(1)}`);
}
await browser.close();
