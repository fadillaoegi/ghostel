// Load probe (M18 hosting sizing): N guests walk around the lobby at 20 Hz and one chats every second.
// Usage: node scripts/load-probe.mjs <guests> <seconds>   (needs pnpm build and pnpm db:up; uses ghostel_test on port 2597)
// Measures what the server process uses (RSS, CPU) and how many bytes each guest receives.
import { execSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(new URL("../apps/server/package.json", import.meta.url));
const WebSocket = require("ws");

const N = Number(process.argv[2] ?? 30);
const LOOK = { body: "violet", accent: "pumpkin", head: "pumpkin", hat: "witch", costume: "cape" };
const SECONDS = Number(process.argv[3] ?? 40);
const PORT = 2597;
const BASE = `http://127.0.0.1:${PORT}`;
const root = fileURLToPath(new URL("..", import.meta.url));

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 50; i++) {
  try {
    if ((await fetch(`${BASE}/api/health`)).ok) break;
  } catch {}
  await sleep(200);
}
const sample = () => {
  const [rss, cpu] = execSync(`ps -o rss=,pcpu= -p ${server.pid}`).toString().trim().split(/\s+/).map(Number);
  return { rssMb: rss / 1024, cpu };
};
await sleep(1500);
const idle = sample();

const clients = [];
for (let i = 0; i < N; i++) {
  let res;
  for (;;) {
    res = await fetch(`${BASE}/api/me`, {
      method: "PUT",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify({ name: `Load ${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`, look: LOOK }),
    });
    if (res.status !== 429) break;
    await sleep(3000);
  }
  if (!res.ok) throw new Error(`PUT /api/me ${res.status}: ${await res.text()}`);
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("ghostel_sid="));
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { headers: { cookie, origin: BASE } });
  const c = { ws, bytes: 0, epoch: 0, x: (Math.random() - 0.5) * 6, z: 7.5, a: Math.random() * 6.28 };
  ws.on("message", (data) => {
    c.bytes += data.length;
    const m = JSON.parse(data.toString());
    if (m.t === "welcome") c.epoch = m.epoch ?? 0;
  });
  await new Promise((r, j) => (ws.once("open", r), ws.once("error", j)));
  clients.push(c);
}
await sleep(1000);
for (const c of clients) c.bytes = 0;
const started = Date.now();
const cpus = [];
const timer = setInterval(() => {
  for (const c of clients) {
    c.a += (Math.random() - 0.5) * 0.6;
    c.x = Math.max(-13, Math.min(13, c.x + Math.sin(c.a) * 0.2));
    c.z = Math.max(-9, Math.min(9, c.z + Math.cos(c.a) * 0.2));
    if (c.ws.readyState === 1) c.ws.send(JSON.stringify({ t: "move", x: +c.x.toFixed(2), z: +c.z.toFixed(2), ry: +c.a.toFixed(2), e: c.epoch }));
  }
}, 50); // 20 Hz, the client's real send rate
const chatTimer = setInterval(() => {
  const c = clients[Math.floor(Math.random() * clients.length)];
  c?.ws.send(JSON.stringify({ t: "chat", text: "boo" }));
}, 1000);
while (Date.now() - started < SECONDS * 1000) {
  await sleep(2000);
  cpus.push(sample());
}
clearInterval(timer);
clearInterval(chatTimer);
const secs = (Date.now() - started) / 1000;
const open = clients.filter((c) => c.ws.readyState === 1).length;
const kbps = clients.map((c) => (c.bytes * 8) / 1000 / secs);
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const loaded = cpus.slice(2);
console.log(`guests=${N} open_at_end=${open} seconds=${secs.toFixed(0)}`);
console.log(`server idle: rss=${idle.rssMb.toFixed(0)} MB`);
console.log(`server loaded: rss max=${Math.max(...loaded.map((s) => s.rssMb)).toFixed(0)} MB, cpu avg=${avg(loaded.map((s) => s.cpu)).toFixed(0)}% (of one core), cpu max=${Math.max(...loaded.map((s) => s.cpu)).toFixed(0)}%`);
console.log(`downstream per guest: avg=${avg(kbps).toFixed(0)} kbit/s; total server out ≈ ${((avg(kbps) * N) / 1000).toFixed(2)} Mbit/s`);
for (const c of clients) c.ws.close();
server.kill("SIGTERM");
await sleep(500);
process.exit(0);
