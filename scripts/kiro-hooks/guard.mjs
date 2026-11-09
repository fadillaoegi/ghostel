// PreToolUse guard: enforces two steering rules (language-and-workflow.md) instead of only stating them.
//   1. The owner handles git: the agent may not run git commands.
//   2. The old project ghostturtle/ghost-turtle-kit must not be touched by shell commands or file writes.
// Exit 2 blocks the tool call; stderr tells the agent why. Allowed calls exit 0 silently and are not logged.
import { pathToFileURL } from "node:url";
import { log, readEvent, strings } from "./lib.mjs";

const OLD_PROJECT = "ghostturtle/ghost-turtle-kit";
const SHELL_TOOLS = /^(execute_bash|shell|execute_cmd|bash)$/;
const WRAPPERS = new Set(["sudo", "env", "command", "exec", "time", "nohup", "xargs"]);

/**
 * Removes text that the shell does not run as commands: heredoc bodies and quoted strings.
 * (Found in real use on 2026-11-09: a heredoc that wrote docs mentioning `git status` was blocked.)
 * Command substitution inside double quotes is dropped too; that is an accepted gap.
 */
export function stripData(commandLine) {
  return commandLine
    .replace(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\s|$)/g, "")
    .replace(/'[^']*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

/** True when any command in a shell line (split on && || ; | newlines and $( ) is git. */
export function runsGit(commandLine) {
  return stripData(commandLine)
    .split(/&&|\|\||;|\||\n|\$\(|`/)
    .map((segment) => segment.trim().split(/\s+/).filter(Boolean))
    .some((words) => {
      let i = 0;
      while (i < words.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i]) || WRAPPERS.has(words[i]))) i++;
      const cmd = words[i] ?? "";
      return cmd === "git" || cmd.endsWith("/git");
    });
}

/** Path-like strings in a file tool's input (not the file content, which may mention anything). */
function pathsOf(input) {
  const all = strings(input);
  const named = all.filter((s) => /path|file|target|dir/i.test(s.key));
  return (named.length > 0 ? named : all.filter((s) => s.value.length < 500 && !/\s/.test(s.value))).map((s) => s.value);
}

export function decide(event) {
  const tool = String(event.tool_name ?? "");
  const input = event.tool_input ?? {};
  if (SHELL_TOOLS.test(tool)) {
    // The command itself, not the tool's description or working directory.
    const all = strings(input);
    const named = all.filter((s) => /^(command|cmd|script)$/i.test(s.key));
    const command = (named.length > 0 ? named : all).map((s) => s.value).join("\n");
    if (runsGit(command)) return { block: true, reason: "Blocked by Ghostel hook: git is handled by the project owner. Do not run git commands (see .kiro/steering/language-and-workflow.md)." };
    if (command.includes(OLD_PROJECT)) return { block: true, reason: `Blocked by Ghostel hook: do not touch the old project (${OLD_PROJECT}).` };
    return { block: false };
  }
  if (pathsOf(input).some((p) => p.includes(OLD_PROJECT))) {
    return { block: true, reason: `Blocked by Ghostel hook: do not write to the old project (${OLD_PROJECT}).` };
  }
  return { block: false };
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const event = await readEvent();
  const verdict = decide(event);
  if (verdict.block) {
    log("guard", event, `BLOCKED ${event.tool_name ?? "?"}: ${verdict.reason}`);
    process.stderr.write(`${verdict.reason}\n`);
    process.exit(2);
  }
  process.exit(0);
}
