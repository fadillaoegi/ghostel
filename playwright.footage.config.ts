import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Demo footage (not a test suite): `pnpm footage`. Same production build and test server as the E2E tests,
// a 1920×1080 window, and the camera from FOOTAGE_CAMERA (a .y4m file) when it is set.
// FOOTAGE_REAL_CAMERA=1 uses the computer's real webcam instead of Chrome's fake devices (the mirror then shows you).
const camera = process.env["FOOTAGE_CAMERA"];
const real = process.env["FOOTAGE_REAL_CAMERA"] === "1";
const baseArgs = (base.use?.launchOptions?.args ?? []).filter((a) => !(real && a.startsWith("--use-fake-")));
const args = [...baseArgs, ...(camera && !real ? [`--use-file-for-fake-video-capture=${camera}`] : [])];

export default defineConfig({
  ...base,
  testDir: "footage",
  testMatch: "*.footage.ts",
  timeout: 300_000,
  reporter: [["list"]],
  use: {
    ...base.use,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    trace: "off",
    launchOptions: { ...base.use?.launchOptions, args },
  },
  projects: [{ name: "footage" }],
});
