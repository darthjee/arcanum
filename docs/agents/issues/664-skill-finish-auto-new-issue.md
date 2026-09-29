# Issue: Skill finish: auto-new-issue

## Description
Parent: #658. Blocked by #659 (`Skill finish: spec`, `docs/agents/specs/skill-finish.md`). The shared scripts (`arcanum/_lib/finish_report.sh`) already exist from #660.

Change how `auto-new-issue` finishes so it follows the standard finish in `docs/agents/specs/skill-finish.md`. It is an **auto** skill, so it never prompts. Instead, its closing report ends with a `Next:` line.

## Problem
Today the skill ends silently. `steps/commit_and_sync.md` says the GitHub sync is the final step and that "no further confirmation or output is required". The early exits in `steps/run.md` (for example `STATUS=existing`) and any script failures have no defined output. The skill is also run nested by `auto-fix-all/steps/process_one_issue.md`, and nothing currently marks that run as nested.

## Expected Behavior
- Every exit path ends with a report rendered by `arcanum/_lib/finish_report.sh --skill auto-new-issue`, relayed verbatim and never hand-formatted:
  - **success**, after the issue file is committed and synced (or minted). Includes `--issue <id>` and `--next "/auto-plan-issue <id>"`.
  - **success**, when Step 1 returns `STATUS=existing`, meaning the issue file already exists. The summary says nothing was written. Includes `--issue <id>` and `--next "/auto-plan-issue <id>"`.
  - **failed**, when `resolve_id_and_file.sh`, `github.sh create`, `commit_issue.sh` or `github.sh update` fails. The summary names the failed step. Includes `--issue` only if an id was known by then. No `--next`.
- A **declined** path does not apply here, because an auto skill never asks the user anything.
- A GitHub fetch failure in Step 2 is still **not** a failure: the skill continues with just the title, as it does today.
- The skill passes no `--label-change`, because it changes no labels. The `Created` label that `auto-fix-all` adds is `auto-fix-all`'s own step and is out of scope.
- **Nested runs:** when the invocation carries `NESTED=true`, the skill calls `finish_report.sh` with the same flags minus `--next`, plus `--nested`. It then ends by relaying the `FINISH_*` block to its caller instead of printing a report.

## Solution
- `auto-new-issue/steps/commit_and_sync.md`: replace the "no further output is required" ending with a closing-report section. Define its success, existing and failed calls, and the rule for `NESTED=true`, following the pattern `plan-issue/steps/write_and_confirm.md` already uses.
- `auto-new-issue/steps/run.md`: route the `STATUS=existing` exit and any Step 1 script failure to that report. Document that `NESTED=true` may arrive in the invocation prompt and must be passed on to any run this skill nests in turn.
- `auto-fix-all/steps/process_one_issue.md`: change the hand-off to `auto-new-issue/steps/run.md` so it passes `NESTED=true`. The spec requires the nested caller to change in the same sub-issue. `auto-fix-all` keeps its `OUTCOME=...` protocol and ignores the returned block.
- `auto-new-issue/SKILL.md` needs no change, because the coordinator already relays the agent's final output verbatim.
- Owner: `skill-writer` for all step and markdown changes. No new scripts are needed.

## Benefits
- Standalone runs end with a predictable, machine-readable summary that points to the next step, `/auto-plan-issue <id>`.
- Runs nested under `auto-fix-all` print nothing, so the pipeline output is not cluttered with a second report.

## Acceptance criteria
- [ ] `auto-new-issue` ends with a `finish_report.sh` report on every exit path: success, existing, and failed
- [ ] Success and existing reports end with `Next: /auto-plan-issue <id>`. Failed reports have no `Next:` line
- [ ] With `NESTED=true`, the skill emits the `--nested` `FINISH_*` block and no report
- [ ] `auto-fix-all/steps/process_one_issue.md` passes `NESTED=true` when it runs `auto-new-issue`
