# Issue: Skill finish: auto-plan-issue

## Description
Parent: #658

Change `auto-plan-issue`'s ending so it follows the standard finish defined in `docs/agents/specs/skill-finish.md`. `auto-plan-issue` is an **auto** skill: it never prompts, and on `success` its closing report ends with `Next: /auto-fix-issue <id>` (per the spec's next-step map).

It is also run **nested** by two callers, so it must support `NESTED=true` the same way `auto-new-issue` already does (`auto-new-issue/steps/run.md`, `auto-new-issue/steps/commit_and_sync.md`).

## Problem
`auto-plan-issue/steps/run.md` currently ends with a free-form Step 6: report that the plan was written and committed, listing the files. Its early exits are also free-form:

- Step 1: `resolve_plan_paths.sh` fails (no issue file) → "stop and report the error".
- Step 1: `PLAN_EXISTS=true` → read the existing plan and stop.
- Step 5: `commit_plan.sh` failing has no defined exit at all.

None of these print the standard closing report, and there is no `NESTED=true` handling.

Of its two nested callers, `discuss-issue/steps/discuss_and_save.md` already passes `NESTED=true` and merges the returned `FINISH_*` block (done in #660). `auto-fix-all/steps/process_one_issue.md` step 3 does **not** pass `NESTED=true` yet — per the spec, the nested caller is updated in the same sub-issue as the nested skill it calls.

## Expected Behavior
Every exit path of `auto-plan-issue` ends with a report rendered by `arcanum/_lib/finish_report.sh`, relayed verbatim as the last thing printed:

| Exit | Status | Flags | `--next` |
| --- | --- | --- | --- |
| Plan written and committed (Step 5 ok) | `success` | `--issue <id>` | `/auto-fix-issue <id>` |
| Plan already exists (`PLAN_EXISTS=true`), nothing written | `success` | `--issue <id>` | `/auto-fix-issue <id>` |
| `resolve_plan_paths.sh` fails | `failed` | `--issue <id>` when parsed | none |
| Exploration / plan writing cannot complete | `failed` | `--issue <id>` | none |
| `commit_plan.sh` fails | `failed` | `--issue <id>` | none |

- No `declined` path: the skill never asks the user anything.
- No `--label-change`: `auto-plan-issue` changes no labels itself (`refined -> ready` is owned by `discuss-issue`, `fetched -> working` by `auto-fix-all`).
- With `NESTED=true`: same flags minus `--next`, plus `--nested`; the skill ends by relaying the `FINISH_*` block verbatim to its caller, with no report and no `Next:` line. It passes `NESTED=true` on to any run it nests (currently none).
- The `SKILL.md` coordinator keeps relaying the architect's final output verbatim, which is now the report.

## Solution
`skill-writer` owns all changes (markdown only; the shared scripts already exist):

- `auto-plan-issue/steps/run.md`:
  - document the optional `NESTED=true` in the invocation prompt (mirroring `auto-new-issue/steps/run.md`);
  - add a closing-report section (success, failed, nested rules), mirroring `auto-new-issue/steps/commit_and_sync.md`'s "Closing report" / "Nested runs" / "Failed exits";
  - wire each exit in the table above to it, including a "fail with `commit_plan.sh`" case in Step 5;
  - replace Step 6 with the `success` report call.
- `auto-fix-all/steps/process_one_issue.md` step 3: add **with `NESTED=true`**, and state that the returned `FINISH_*` block is not relayed or merged (`auto-fix-all` keeps its `OUTCOME=...` protocol), matching how step 2 already handles `auto-new-issue`. If the nested block has `FINISH_STATUS=failed`, treat it as the plan step failing.
- No change needed in `discuss-issue` (already passes `NESTED=true` and merges the block).
