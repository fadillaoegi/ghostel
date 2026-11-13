// `pnpm dev:lan`: the dev setup, reachable from phones and laptops on the same Wi-Fi.
// - The web dev server (Vite) listens on every interface, over HTTPS with a self-signed certificate
//   (camera, microphone and screen share need HTTPS outside localhost).
// - The API and WebSocket server stays on 127.0.0.1; Vite proxies /api and /ws to it.
// - ALLOWED_ORIGINS gets this machine's LAN addresses, so the server's Origin check accepts them.
//   Environment variables win over .env, so .env is not changed.
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const PORT = 5290;

/** Private IPv4 addresses of this machine (Wi-Fi, Ethernet, hotspot). */
function lanAddresses() {
  const out = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family !== "IPv4" || a.internal) continue;
      if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)) out.push(a.address);
    }
  }
  return [...new Set(out)];
}

function originsFromEnvFile() {
  const file = new URL("../.env", import.meta.url);
  if (!existsSync(file)) return [];
  const line = readFileSync(file, "utf8")
    .split("\n")
    .find((l) => l.startsWith("ALLOWED_ORIGINS="));
  return line ? line.slice("ALLOWED_ORIGINS=".length).split(",").map((o) => o.trim()).filter(Boolean) : [];
}

const ips = lanAddresses();
if (ips.length === 0) {
  console.error("No local network address found. Connect this machine to Wi-Fi and try again.");
  process.exit(1);
}
const lanOrigins = ["localhost", "127.0.0.1", ...ips].map((h) => `https://${h}:${PORT}`);
const origins = [...new Set([...(process.env["ALLOWED_ORIGINS"]?.split(",") ?? originsFromEnvFile()), ...lanOrigins])].join(",");

console.log("\nGhostel on your local network (HTTPS, self-signed certificate):");
for (const ip of ips) console.log(`  https://${ip}:${PORT}`);
console.log(`  https://localhost:${PORT}  (this machine)`);
console.log("Open one of these on a phone or laptop on the same Wi-Fi.");
console.log('The browser warns about the certificate the first time: choose "Advanced" → "Proceed" (or "Show details" → "visit this website" on iPhone).\n');

const child = spawn("pnpm", ["dev"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, GHOSTEL_LAN: "1", ALLOWED_ORIGINS: origins },
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code) => process.exit(code ?? 0));
