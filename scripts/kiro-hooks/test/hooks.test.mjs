// Unit tests for the Kiro hook scripts: they get the same kind of JSON on stdin that Kiro sends.
// Run with `pnpm test:hooks`. These prove the scripts' logic; they do not prove Kiro fires the hooks.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, runsGit } from "../guard.mjs";
import { openItems } from "../session-status.mjs";

const DIR = resolve(import.meta.dirname, "..");

function hook(script, event) {
  const log = join(mkdtempSync(join(tmpdir(), "kiro-hook-")), "hooks.log");
  const res = spawnSync(process.execPath, [join(DIR, script)], {
    input: JSON.stringify(event),
    encoding: "utf8",
    env: { ...process.env, KIRO_HOOK_LOG: log },
  });
  return { code: res.status, stdout: res.stdout, stderr: res.stderr, log: existsSync(log) ? readFileSync(log, "utf8") : "" };
}

test("runsGit finds git in any part of a command line", () => {
  for (const cmd of ["git status", "cd apps && git log", "FOO=1 git push", "pnpm build; git commit -m x", "echo $(git rev-parse HEAD)", "sudo git reset --hard", "/usr/bin/git diff"]) {
    assert.equal(runsGit(cmd), true, cmd);
  }
  for (const cmd of ['grep -n "git status" README.md', "pnpm exec playwright test", "cat .gitignore", "ls digital", "node scripts/x.mjs --git"]) {
    assert.equal(runsGit(cmd), false, cmd);
  }
  // Seen in a real session: text written through a heredoc or inside quotes is data, not a command.
  const heredoc = "python3 - <<'EOF'\ns = '''\n- Ask the agent to run `git status`.\ngit log\n'''\nEOF\ngrep -n x docs/HANDOFF.md";
  assert.equal(runsGit(heredoc), false);
  assert.equal(runsGit("echo 'run `git push` later' && ls"), false);
  assert.equal(runsGit("cat > f <<EOF\ngit commit\nEOF\ngit status"), true);
});

test("guard blocks git and the old project, allows normal work", () => {
  assert.equal(decide({ tool_name: "execute_bash", tool_input: { command: "git status" } }).block, true);
  assert.equal(decide({ tool_name: "execute_bash", tool_input: { command: "ls /Users/boo/Github/project/Hacketon/ghostturtle/ghost-turtle-kit" } }).block, true);
  assert.equal(decide({ tool_name: "fs_write", tool_input: { path: "/Users/boo/Github/project/Hacketon/ghostturtle/ghost-turtle-kit/x.md", text: "hi" } }).block, true);
  assert.equal(decide({ tool_name: "execute_bash", tool_input: { command: "pnpm typecheck" } }).block, false);
  // Writing a doc that merely mentions the old project is fine.
  assert.equal(decide({ tool_name: "str_replace", tool_input: { path: "AGENTS.md", oldStr: "a", newStr: "do not touch ghostturtle/ghost-turtle-kit" } }).block, false);
});

test("guard script: exit 2 with a reason and a log line when blocking, silent exit 0 otherwise", () => {
  const blocked = hook("guard.mjs", { hook_event_name: "PreToolUse", tool_name: "execute_bash", tool_input: { command: "git push --force" } });
  assert.equal(blocked.code, 2);
  assert.match(blocked.stderr, /git is handled by the project owner/);
  assert.match(blocked.log, /\tguard\tPreToolUse\tBLOCKED execute_bash/);
  const allowed = hook("guard.mjs", { hook_event_name: "PreToolUse", tool_name: "execute_bash", tool_input: { command: "pnpm test" } });
  assert.equal(allowed.code, 0);
  assert.equal(allowed.stderr, "");
  assert.equal(allowed.log, "");
});

test("session status prints the open items and evidence, and logs the run", () => {
  const res = hook("session-status.mjs", { hook_event_name: "SessionStart" });
  assert.equal(res.code, 0);
  assert.match(res.stdout, /^Ghostel project status/);
  assert.match(res.stdout, /Latest recorded checks: .*typecheck exit \d/);
  assert.match(res.log, /\tsession-status\tSessionStart\t\d+ open items/);
  assert.deepEqual(openItems("## Open items\n1. **First**: x\n2. **Second** y\n## Next\n3. **No**"), ["First", "Second"]);
});

test("shared-tests hook runs the shared tests and logs PASS with the summary", () => {
  const res = hook("shared-tests.mjs", { hook_event_name: "PostFileSave", file_path: "/w/packages/shared/src/rooms.ts" });
  assert.equal(res.code, 0, res.stderr);
  assert.match(res.log, /\tshared-tests\tPostFileSave\tpackages\/shared\/src\/rooms\.ts -> PASS Tests\s+\d+ passed/);
});
