// PostFileSave hook: after the agent saves a file in packages/shared, run the shared domain tests.
// Passing runs are only logged; failing runs exit 1 so Kiro shows a warning with the failing summary.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { ROOT, log, readEvent, strings } from "./lib.mjs";

const SHARED_FILE = /packages\/shared\/(src|test)\/[^\s"]*\.ts/;

const event = await readEvent();
const file = strings(event)
  .map((s) => s.value)
  .find((v) => SHARED_FILE.test(v));
const shown = file ? (file.match(SHARED_FILE)?.[0] ?? file) : "(no shared file in the event)";

const shared = resolve(ROOT, "packages/shared");
const run = spawnSync(resolve(shared, "node_modules/.bin/vitest"), ["run", "--reporter=dot"], {
  cwd: shared,
  encoding: "utf8",
  env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
  timeout: 80_000,
});
const out = `${run.stdout ?? ""}${run.stderr ?? ""}`.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
const summary = out.match(/Tests\s+[^\n]+/)?.[0]?.trim() ?? `vitest exited with ${run.status ?? run.signal}`;
const ok = run.status === 0;
log("shared-tests", event, `${shown} -> ${ok ? "PASS" : "FAIL"} ${summary}`);
if (!ok) {
  process.stderr.write(`Shared tests failed after saving ${shown}: ${summary}\n${out.split("\n").slice(-25).join("\n")}\n`);
  process.exit(1);
}
