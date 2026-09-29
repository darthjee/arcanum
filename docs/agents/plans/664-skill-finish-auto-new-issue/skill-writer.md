# Plan: Skill finish: auto-new-issue

Issue: [664-skill-finish-auto-new-issue.md](../../issues/664-skill-finish-auto-new-issue.md)

## Overview

Replace `auto-new-issue`'s silent ending with the standard finish from `docs/agents/specs/skill-finish.md`. It is an auto skill, so it never prompts: success reports carry `--next "/auto-plan-issue <id>"`. With `NESTED=true`, it emits the `--nested` result block instead. The one nested caller, `auto-fix-all/steps/process_one_issue.md`, starts passing `NESTED=true`.

## Context

- `arcanum/_lib/finish_report.sh` already exists (#660). Its interface: `finish_report.sh <repo_path> --skill <name> --status success|declined|failed --summary "<text>" [--issue <id>] [--next "<cmd>"]... [--nested]`.
- Precedent for wording and structure: `plan-issue/steps/write_and_confirm.md` (closing-report section and "Failed exits" section) and `discuss-issue/steps/discuss_and_save.md` (hand-off to a nested run with `NESTED=true`).
- Exit paths agreed in the issue:
  - **success**: the issue was created and synced, or minted. Report with `--issue <id> --next "/auto-plan-issue <id>"`.
  - **success**: `STATUS=existing` (the file already exists; nothing written). Report with `--issue <id> --next "/auto-plan-issue <id>"`.
  - **failed**: `resolve_id_and_file.sh`, `github.sh create`, `commit_issue.sh` or `github.sh update` failed. The summary names the failed step. `--issue` is passed only if an id was known by then. No `--next`.
  - There is no declined path, because the skill never asks the user anything. A GitHub fetch failure in Step 2 is still not a failure.
  - There is no `--label-change`, because the skill changes no labels.
- Nested rule: with `NESTED=true`, use the same flags minus `--next`, plus `--nested`. End by relaying the `FINISH_*` stdout verbatim, with no report and no `Next:` line.
- `auto-new-issue/SKILL.md` needs no change: the coordinator already relays the architect's final output verbatim.

## Steps

- [01 — Closing report in commit_and_sync.md](skill-writer/01-closing-report-commit-and-sync.md)
- [02 — Route run.md exits to the report and accept NESTED](skill-writer/02-run-exits-and-nested.md)
- [03 — Pass NESTED=true from auto-fix-all](skill-writer/03-auto-fix-all-nested.md)

## Notes

- Scripts are resolved relative to the `auto-new-issue` skill folder in these step files (e.g. `scripts/github.sh`), so reference the report script as `../arcanum/_lib/finish_report.sh`, relative to that same folder, and say so explicitly.
- Do not touch the `auto-plan-issue` hand-off in `process_one_issue.md` §3. Its `NESTED=true` belongs to #665.
- The stale remark in `process_one_issue.md` about "the manual `/new-issue` skill" is out of scope.
