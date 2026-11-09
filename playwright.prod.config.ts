import { defineConfig, devices } from "@playwright/test";

// Smoke test of the production build with NODE_ENV=production (`__Host-` Secure cookie, CSP, logging).
// Uses http://localhost, which Chromium treats as a secure origin, so Secure cookies work without TLS.
const PORT = 2597;
const BASE = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e-prod",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: BASE,
    launchOptions: {
      args:
        process.platform === "darwin"
          ? ["--use-angle=metal", "--ignore-gpu-blocklist"]
          : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 820 } } }],
  webServer: {
    command: "node apps/server/scripts/reset-test-db.mjs && node apps/server/dist/main.js",
    url: `${BASE}/api/health`,
    reuseExistingServer: false,
    stdout: "pipe",
    env: {
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: String(PORT),
      DATABASE_URL:
        process.env["TEST_DATABASE_URL"] ?? "postgres://ghostel:ghostel_local_only@127.0.0.1:5490/ghostel_test",
      ALLOWED_ORIGINS: BASE,
      TRUST_PROXY: "1",
    },
  },
});
