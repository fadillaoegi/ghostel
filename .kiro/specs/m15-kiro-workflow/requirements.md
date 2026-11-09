# Requirements — M15: a provable Kiro workflow (hooks, steering, specs, activity log)

Owner request (2026-11-09, Indonesian, summarised): before deploying, tidy the Kiro story: steering, specs, hooks that are proven to run, and the activity log; re-check the official Devpost rules. The owner approved Kiro's plan ("oke lanjut").

## Why
Judges assess "meaningful Kiro usage". Until now the one hook in `.kiro/hooks/` was never seen running, M11–M14 specs were written after their code, and the activity log is long and chronological with no overview.

## Acceptance criteria
1. **Hooks leave evidence.** Every project hook appends one line per run to `docs/evidence/kiro-hooks.log` (time, trigger, what it saw, result). A hook that cannot be shown to run in a real Kiro session is not claimed to work.
2. **The shared-tests hook** runs the `packages/shared` unit tests after the agent saves a file there, uses the documented schema (`timeout` on the hook), and reports failures as a visible warning (non-zero exit).
3. **A guard hook** (PreToolUse) blocks `git` commands run by the agent and writes or shell commands that touch the old project `ghostturtle/ghost-turtle-kit`, so two steering rules are enforced by Kiro, not only written down. Blocking uses exit code 2 with a reason on stderr.
4. **A session-start hook** adds a short project status (the open items from `docs/HANDOFF.md` and the latest check results) to the agent's context.
5. The hook scripts are plain Node (no extra packages), work from the workspace root, and have unit tests that feed them sample hook input.
6. **Steering** is current (no stale statements) and uses more than one inclusion mode where it helps: always-on rules, a `fileMatch` style guide for 3D files, and a `manual` submission checklist.
7. **Specs:** every milestone folder has requirements, design and tasks; specs written after their code say so at the top; `.kiro/specs/README.md` lists all milestones with status.
8. **Activity log:** `docs/KIRO-ACTIVITY.md` starts with a judge-facing overview (how Kiro was used, with links to evidence); the detailed session log stays below, unchanged in substance.
9. **Devpost rules:** recorded from the official page once the owner provides its text (the page returns 403 to Kiro's fetch tool); until then the requirements stay marked as "from secondary sources".
