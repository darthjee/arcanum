# Skill-writer Plan: Skill finish: auto-plan-issue

Main plan: [plan.md](plan.md)

## Overview
Rewrite `auto-plan-issue`'s ending against `docs/agents/specs/skill-finish.md`: an auto skill, so it never prompts; every exit path prints a `finish_report.sh` report; on `success` the report carries `--next "/auto-fix-issue <id>"`. With `NESTED=true`, every call drops `--next`, adds `--nested`, and the run ends by relaying the `FINISH_*` block to its caller. Then make `auto-fix-all`'s nested call pass `NESTED=true`.

Follow the already-implemented pattern in `auto-new-issue/steps/run.md` and `auto-new-issue/steps/commit_and_sync.md` ("Closing report", "Nested runs", "Failed exits", "Success report") as closely as possible — same wording, same structure — so the auto skills read alike.

## Context
Exit table agreed in the issue:

| Exit | Status | Flags | `--next` |
| --- | --- | --- | --- |
| Plan written and committed (Step 5 ok) | `success` | `--issue <id>` | `/auto-fix-issue <id>` |
| Plan already exists (`PLAN_EXISTS=true`), nothing written | `success` | `--issue <id>` | `/auto-fix-issue <id>` |
| `resolve_plan_paths.sh` fails | `failed` | `--issue <id>` when parsed | none |
| Exploration / plan writing cannot complete | `failed` | `--issue <id>` | none |
| `commit_plan.sh` fails | `failed` | `--issue <id>` | none |

- No `declined` path (the skill never asks the user anything).
- No `--label-change` on any path: `auto-plan-issue` changes no labels itself.
- `finish_report.sh` resolves as `../arcanum/_lib/finish_report.sh` relative to the `auto-plan-issue` skill folder, with `"$REPO_PATH"` as first argument.
- `discuss-issue/steps/discuss_and_save.md` already passes `NESTED=true` and merges the block — do not touch it.
- `auto-plan-issue/SKILL.md` already relays the architect's final output verbatim — no change needed.

## Steps

- [01 — Add NESTED and closing-report rules to run.md](skill-writer/01-closing-report-section.md)
- [02 — Wire every exit path in run.md](skill-writer/02-wire-exit-paths.md)
- [03 — Pass NESTED=true from auto-fix-all](skill-writer/03-auto-fix-all-nested.md)

## Notes
- Skills never hand-format, extend or paraphrase the report; the report (or the `FINISH_*` block when nested) is the last thing printed.
- If `finish_report.sh` itself exits non-zero (usage error), say in one line that the closing report could not be rendered, and end — same as `auto-new-issue`.
- No CI job covers skill markdown; verify by re-reading the changed files and checking that every relative link resolves.
