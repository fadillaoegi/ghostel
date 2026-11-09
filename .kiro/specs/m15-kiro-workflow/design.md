# Design — M15

## Hooks (`.kiro/hooks/*.json`, scripts in `scripts/kiro-hooks/`)
Facts from the Kiro docs (asked through Kiro's `introspect` agent on 2026-11-09, sources https://kiro.dev/docs/hooks.md, https://kiro.dev/docs/hooks/types.md, https://kiro.dev/docs/hooks/actions.md):
- File triggers (`PostFileSave`, …) fire only for changes made by the agent, and only in the CLI V3 harness.
- Hooks load at session start.
- Exit 0 output is ignored for most triggers (added to context for SessionStart and UserPromptSubmit). Exit 2 blocks PreToolUse. Other codes show a warning.
- `timeout` (seconds) sits on the hook, not in `action`.
- The stdin JSON has `hook_event_name`, `cwd`, `session_id`, and for tool hooks `tool_name`, `tool_input` and `tool_response`. Field names inside `tool_input` are not documented, so the scripts search the input for commands and paths instead of relying on one key.

| Hook file | Trigger / matcher | Script | Behaviour |
| --- | --- | --- | --- |
| `shared-tests-on-save.json` | PostFileSave, `packages/shared/(src\|test)/.*\.ts$` | `shared-tests.mjs` | runs `vitest run` in `packages/shared`, logs the summary, exits 1 if tests fail |
| `guard-git-and-old-project.json` | PreToolUse, `^(execute_bash\|shell\|fs_write\|fs_append\|str_replace\|delete_file)$` | `guard.mjs` | exit 2 for a `git` command (any segment of a shell command line) or any mention of `ghostturtle/ghost-turtle-kit`; logs blocked calls only |
| `session-status.json` | SessionStart | `session-status.mjs` | prints the HANDOFF open items (titles only) and the exit codes in `docs/evidence/*.txt`; logs one line |

`scripts/kiro-hooks/log.mjs` appends to `docs/evidence/kiro-hooks.log` (ISO time, hook, detail). Tests in `scripts/kiro-hooks/test/*.test.mjs` use Node's built-in test runner (`node --test`) with sample stdin; root script `pnpm test:hooks`.

## Steering
- Update stale lines in `architecture.md` (storage, call model, PostgreSQL 18).
- Add a "Kiro hooks" section to `language-and-workflow.md`.
- New `visual-style.md` (`inclusion: fileMatch`, `fileMatchPattern: apps/web/src/three/**`): low-poly rules, colour palette, performance budget.
- New `submission.md` (`inclusion: manual`): checklist for the Devpost submission, filled from the official rules.

## Specs
- Add `design.md` to `m13-camera` and `m14-presentation` (moved out of requirements). Add a "Written after implementation" note to M11–M14. `.kiro/specs/README.md` index.

## Activity log
- New top section "Overview for judges" in `docs/KIRO-ACTIVITY.md`: Kiro features used with counts and links, owner decisions made through Kiro, problems Kiro caught, what is not proven.

## Changes during implementation (2026-11-09)
- The owner denied edits to `.kiro/hooks/shared-tests-on-save.json`, so that file is unchanged. It still runs vitest directly with `timeout` inside `action`, and its runs are not logged. `scripts/kiro-hooks/shared-tests.mjs` (tested) is ready if the owner later points the hook at it.
- The two new hook files were written by Kiro's `createHook` tool. That tool puts `timeout` inside `action`, while the hooks documentation shows it on the hook. Which one Kiro reads is checked in the verification session (task 3).
- Hook commands use absolute paths to the scripts, because the hook's working directory is not documented.
