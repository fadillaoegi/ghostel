// Frame-rate probe (M19): opens the built app in Chromium (Metal on macOS), visits every scene and
// measures frames for a few seconds each. Prints fps, frame-time percentiles, long tasks and main-thread
// time per second (Chrome DevTools Protocol metrics).
// Usage: node scripts/perf-probe.mjs [deviceScaleFactor=2] [seconds=5]
// Needs `pnpm build` and `pnpm db:up`; starts its own server on port 2597 against ghostel_test.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const DSF = Number(process.argv[2] ?? 2);
const SECONDS = Number(process.argv[3] ?? 5);
/** PROFILE=1 adds a JS CPU profile of the lobby (top functions by self time). */
const PROFILE = process.env["PROFILE"] === "1";
const PORT = 2597;
const BASE = `http://127.0.0.1:${PORT}`;
const root = fileURLToPath(new URL("..", import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn("node", ["apps/server/dist/main.js"], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: "development",
    HOST: "127.0.0.1",
    PORT: String(PORT),
    DATABASE_URL: "postgres://ghostel:ghostel_local_only@127.0.0.1:5490/ghostel_test",
    ALLOWED_ORIGINS: BASE,
  },
  stdio: ["ignore", "ignore", "inherit"],
});
for (let i = 0; i < 50; i++) {
  try {
    if ((await fetch(`${BASE}/api/health`)).ok) break;
  } catch {}
  await sleep(200);
}

const args = process.platform === "darwin" ? ["--use-angle=metal", "--ignore-gpu-blocklist"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const browser = await chromium.launch({ args });
const context = await browser.newContext({ viewport: { width: 1366, height: 820 }, deviceScaleFactor: DSF });
const page = await context.newPage();
// Count WebGL draw calls (test-only instrumentation, injected before the app loads).
await page.addInitScript(() => {
  const w = window;
  w.__draws = 0;
  for (const proto of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
    for (const name of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"]) {
      const original = proto[name];
      if (!original) continue;
      proto[name] = function (...a) {
        w.__draws++;
        return original.apply(this, a);
      };
    }
  }
});
const cdp = await context.newCDPSession(page);
await cdp.send("Performance.enable");
const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));

async function measure(label) {
  await sleep(1500); // let the scene settle
  const before = await metrics();
  const r = await page.evaluate(async (ms) => {
    const gaps = [];
    let long = 0;
    const draws0 = window.__draws;
    const po = new PerformanceObserver((l) => (long += l.getEntries().length));
    try {
      po.observe({ type: "longtask" });
    } catch {}
    await new Promise((resolve) => {
      const start = performance.now();
      let last = start;
      const tick = (t) => {
        gaps.push(t - last);
        last = t;
        if (t - start < ms) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    po.disconnect();
    gaps.shift();
    const sorted = [...gaps].sort((a, b) => a - b);
    const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
    const canvas = document.querySelector("canvas");
    return {
      fps: gaps.length / (ms / 1000),
      p50: q(0.5),
      p95: q(0.95),
      max: sorted.at(-1) ?? 0,
      slow: gaps.filter((g) => g > 25).length,
      long,
      px: canvas ? `${canvas.width}x${canvas.height}` : "?",
      drawsPerFrame: (window.__draws - draws0) / Math.max(1, gaps.length + 1),
    };
  }, SECONDS * 1000);
  const after = await metrics();
  const perSec = (k) => (((after[k] ?? 0) - (before[k] ?? 0)) / SECONDS) * 1000;
  console.log(
    [
      label.padEnd(10),
      `fps ${r.fps.toFixed(1)}`,
      `p50 ${r.p50.toFixed(1)} ms`,
      `p95 ${r.p95.toFixed(1)} ms`,
      `max ${r.max.toFixed(0)} ms`,
      `>25ms ${r.slow}`,
      `longtasks ${r.long}`,
      `script ${perSec("ScriptDuration").toFixed(0)} ms/s`,
      `task ${perSec("TaskDuration").toFixed(0)} ms/s`,
      `draws/frame ${r.drawsPerFrame.toFixed(0)}`,
      `canvas ${r.px}`,
    ].join(" | "),
  );
}

async function ride(n) {
  await page.getByRole("button", { name: "Elevator", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`Floor ${n}`) }).click();
  await page.getByTestId("place-name").filter({ hasText: n === 1 ? "Grand Lobby" : `${n}F` }).waitFor();
}

try {
  await page.goto(BASE);
  await page.getByLabel("Your name").fill("Perf Probe");
  await page.getByRole("button", { name: /Check in/ }).click();
  await page.getByTestId("connection-status").filter({ hasText: "Live" }).waitFor({ timeout: 30_000 });
  console.log(`deviceScaleFactor ${DSF}, ${SECONDS} s per scene, viewport 1366x820`);
  await measure("lobby");
  if (PROFILE) {
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.start");
    await sleep(SECONDS * 1000);
    const { profile } = await cdp.send("Profiler.stop");
    const self = new Map();
    const dt = new Map();
    profile.timeDeltas.forEach((d, i) => dt.set(profile.samples[i], (dt.get(profile.samples[i]) ?? 0) + d));
    for (const n of profile.nodes) {
      const t = (dt.get(n.id) ?? 0) / 1000;
      if (!t) continue;
      const f = n.callFrame;
      const key = `${f.functionName || "(anonymous)"} ${f.url.split("/").pop()}:${f.lineNumber + 1}`;
      self.set(key, (self.get(key) ?? 0) + t);
    }
    const total = [...self.values()].reduce((a, b) => a + b, 0);
    console.log(`lobby JS profile (${SECONDS} s), top self time:`);
    for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 18)) console.log(`  ${v.toFixed(0).padStart(6)} ms  ${((v / total) * 100).toFixed(1).padStart(5)}%  ${k}`);
  }
  for (const n of [2, 3, 4, 5]) {
    await ride(n);
    await measure(`floor ${n}`);
  }
  await ride(1);
  await page.getByRole("button", { name: "Rooms" }).click();
  await page.getByRole("button", { name: "Enter Pumpkin Trivia Hall" }).click();
  await page.getByTestId("place-name").filter({ hasText: "1A" }).waitFor();
  await measure("room 1A");
} finally {
  await browser.close();
  server.kill("SIGTERM");
}
