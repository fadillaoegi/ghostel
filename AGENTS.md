# AGENTS.md

Instructions for AI coding agents (Kiro and others) working on Ghostel.

## Read first
- `.kiro/steering/` — product, architecture, security, language/workflow and attribution rules. They apply to every change.
- `.kiro/specs/` — the spec for the current milestone. Implement tasks from `tasks.md` in order and tick them off.
- `docs/HANDOFF.md` — where the last session stopped.

## Kiro hooks
- `.kiro/hooks/guard-git-and-old-project.json` blocks git commands and writes to the old project. If it blocks you, ask the owner; do not work around it.
- Hook runs are logged to `docs/evidence/kiro-hooks.log`.

## Hard rules
- Do not run git commands. The owner handles git.
- Talk to the owner in Indonesian. Write code, UI, docs and submission material in English.
- TypeScript strict, no `eval`. Domain rules live in `packages/shared` with no React, DOM, `ws` or `pg` imports.
- Server is authoritative for positions, membership, passwords, turns, timers and scores. Validate every client input on the server.
- Never invent test results, screenshots or Kiro usage. Save real output in `docs/evidence/`.
- Do not touch `/Users/boo/Github/project/Hacketon/ghostturtle/ghost-turtle-kit` (no deletes, no edits to its Codex notes, avoid ports 5178, 5179, 8098, 5478).

## Commands
```sh
pnpm install
pnpm db:up            # PostgreSQL 18 in Docker on 127.0.0.1:5490
pnpm dev              # server on :2590, web on :5290 (open http://localhost:5290)
pnpm typecheck
pnpm test             # unit + server integration (needs db:up)
pnpm test:e2e         # Playwright, two browser contexts
pnpm build
pnpm test:hooks       # tests for the Kiro hook scripts in scripts/kiro-hooks/
```
