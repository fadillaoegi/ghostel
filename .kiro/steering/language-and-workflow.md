# Language and workflow

- Discussion with the project owner: Indonesian.
- UI text, code, code comments, project docs and submission material: English.
- Git is handled by the owner. Do not run any git command.
- Before implementing a milestone, write or update a spec in `.kiro/specs/<milestone>/` (requirements, design, tasks). If a spec is ever written after the code, say so at the top of the spec and in `docs/KIRO-ACTIVITY.md`.
- After each session update `README.md`, `docs/PROGRESS.md`, `docs/HANDOFF.md`, `docs/KIRO-ACTIVITY.md` and `docs/ASSETS.md`.
- Store real command output of tests, typecheck and build in `docs/evidence/`. Never invent test results, screenshots, tool usage or time saved.
- Old project at `/Users/boo/Github/project/Hacketon/ghostturtle/ghost-turtle-kit`: do not delete it, its container `ghost-turtle-kit-postgres-1` or volume `ghost-turtle-kit_ghost_data`. Do not touch its Codex attribution notes. Stop its dev launcher or archive it only with explicit owner approval.

## Kiro hooks (`.kiro/hooks/`)
- `guard-git-and-old-project.json` (PreToolUse) enforces two of the rules above: it blocks git commands and any shell command or file write that touches the old project. If it blocks you, do not work around it; ask the owner.
- `session-status.json` (SessionStart) adds the open items from `docs/HANDOFF.md` and the latest check results to the context.
- `shared-tests-on-save.json` (PostFileSave on `packages/shared`) runs the shared unit tests after the agent saves a file there. It does not write to the log, and it is silent when the tests pass.
- Hook scripts live in `scripts/kiro-hooks/` and are tested with `pnpm test:hooks`. The guard and session-status scripts append one line per run to `docs/evidence/kiro-hooks.log`. Only claim a hook works when that log or Kiro's own output shows it ran in a real session.
