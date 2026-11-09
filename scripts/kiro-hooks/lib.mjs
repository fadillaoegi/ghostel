// Shared helpers for the project's Kiro hooks. Plain Node, no packages.
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Workspace root (two levels above this file), so hooks work whatever the current directory is. */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const LOG = process.env.KIRO_HOOK_LOG ?? resolve(ROOT, "docs/evidence/kiro-hooks.log");

/** Reads the hook event JSON from stdin. Returns {} when there is none or it is not JSON. */
export async function readEvent() {
  if (process.stdin.isTTY) return {};
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** One line per hook run: time, hook, event, detail. Evidence that the hook really ran. */
export function log(hook, event, detail) {
  const line = `${new Date().toISOString()}\t${hook}\t${event?.hook_event_name ?? "?"}\t${String(detail).replace(/\s+/g, " ").slice(0, 400)}\n`;
  try {
    mkdirSync(dirname(LOG), { recursive: true });
    appendFileSync(LOG, line);
  } catch {
    // Logging must never break the agent's work.
  }
}

/** Every string inside a value, with the key it was found under. */
export function strings(value, key = "") {
  if (typeof value === "string") return [{ key, value }];
  if (Array.isArray(value)) return value.flatMap((v) => strings(v, key));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => strings(v, k));
  return [];
}
