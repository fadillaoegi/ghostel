import { defineConfig, devices } from "@playwright/test";

// E2E runs against the production build (server serves web + API + WebSocket on one origin),
// on its own port and the test database so it never touches dev data.
const PORT = 2595;
const BASE = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: BASE,
    trace: "retain-on-failure",
    // Real GPU on macOS (Metal); software WebGL elsewhere (e.g. CI). SwiftShader runs the lobby at only a few fps.
    // Fake microphone (a beep) and auto-granted mic permission for voice tests; plain IPs instead of mDNS for localhost ICE.
    launchOptions: {
      args: [
        ...(process.platform === "darwin"
          ? ["--use-angle=metal", "--ignore-gpu-blocklist"]
          : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]),
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--disable-features=WebRtcHideLocalIpsWithMdns",
        "--autoplay-policy=no-user-gesture-required",
      ],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 820 } } }],
  webServer: {
    command: "node apps/server/scripts/reset-test-db.mjs && node apps/server/dist/main.js",
    url: `${BASE}/api/health`,
    reuseExistingServer: false,
    stdout: "pipe",
    env: {
      NODE_ENV: "development",
      HOST: "127.0.0.1",
      PORT: String(PORT),
      DATABASE_URL:
        process.env["TEST_DATABASE_URL"] ?? "postgres://ghostel:ghostel_local_only@127.0.0.1:5490/ghostel_test",
      ALLOWED_ORIGINS: BASE,
      // Short Pumpkin Trivia rounds so browser tests finish quickly.
      TRIVIA_FAST: "1",
    },
  },
});
