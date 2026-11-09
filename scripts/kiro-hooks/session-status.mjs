// SessionStart hook: puts a short project status into the agent's context (stdout of a SessionStart hook is
// added to context), so every Kiro session starts from where the last one stopped.
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, log, readEvent } from "./lib.mjs";

/** Titles of the numbered items under "## Open items" in HANDOFF.md (the bold part of each line). */
export function openItems(handoff) {
  const section = handoff.split(/^## Open items\s*$/m)[1]?.split(/^## /m)[0] ?? "";
  return section
    .split("\n")
    .map((line) => /^\d+\.\s+\*\*(.+?)\*\*/.exec(line)?.[1])
    .filter(Boolean);
}

/** "typecheck exit 0 (2026-11-09 07:31)" for each evidence file. */
export function evidence(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".txt"))
    .sort()
    .map((f) => {
      const text = readFileSync(resolve(dir, f), "utf8");
      const when = /^# (\d{4}-\d{2}-\d{2} \d{2}:\d{2})/.exec(text)?.[1] ?? "?";
      const code = /# exit code: (\d+)\s*$/.exec(text)?.[1] ?? "?";
      return `${f.replace(/\.txt$/, "")} exit ${code} (${when})`;
    });
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const event = await readEvent();
  let items = [];
  let checks = [];
  try {
    items = openItems(readFileSync(resolve(ROOT, "docs/HANDOFF.md"), "utf8"));
    checks = evidence(resolve(ROOT, "docs/evidence"));
  } catch {
    // Missing files: print what we have.
  }
  process.stdout.write(
    [
      "Ghostel project status (from the SessionStart hook in .kiro/hooks/session-status.json):",
      "Read AGENTS.md, .kiro/steering/ and docs/HANDOFF.md before changing code.",
      `Open items in docs/HANDOFF.md: ${items.length ? items.map((t, i) => `${i + 1}) ${t}`).join("; ") : "none listed"}.`,
      `Latest recorded checks: ${checks.join("; ") || "none"}.`,
    ].join("\n") + "\n",
  );
  log("session-status", event, `${items.length} open items, ${checks.length} evidence files`);
}
