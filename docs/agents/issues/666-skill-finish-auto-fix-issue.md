# Issue: Skill finish: auto-fix-issue

## Description
Parent: #658. Depends on the shared scripts from the `Skill finish: spec` work (`docs/agents/specs/skill-finish.md`, `arcanum/_lib/finish_report.sh`), already delivered with #660.

Change every exit of `auto-fix-issue` so it ends with the standard closing report from `docs/agents/specs/skill-finish.md`, and make `auto-fix-all` run it nested.

## Problem
`auto-fix-issue` ends by free-form reporting the PR URL (`steps/run.md` Step 6, `steps/open_pr.md` "Report"). Early exits (no issue file, no plan, merge conflict or dispatch that cannot be resolved, `gh` error) just "stop and report the error" with no fixed shape. `auto-fix-all/steps/process_one_issue.md` §4 runs it without `NESTED=true`, so once it prints a report, that report would leak into `auto-fix-all`'s `OUTCOME=...` protocol.

## Expected Behavior
- Every exit ends with exactly one report from `arcanum/_lib/finish_report.sh --skill auto-fix-issue`, relayed verbatim as the last output:
  - **success** (PR created, marked ready, already open and ready, or resume from `pr_published`): `--issue <id> --pr <n>`, `--label-change :pr` when `pr-create`/`pr-ready` ran, and `--next "/auto-monitor-issue-pr <id>"`.
  - **failed** (issue/plan not resolvable, `PLAN_EXISTS=false`, unresolved merge conflict, blocked or failing specialist, `gh` error): summary names the failed step; no `--next`.
  - No `declined` status: the skill never prompts.
- `NESTED=true` in the invocation drops `--next`, adds `--nested`, and the run ends by relaying the `FINISH_*` block.
- `auto-fix-all/steps/process_one_issue.md` §4 passes `NESTED=true`, reads the PR number from `FINISH_PR`, and maps `FINISH_STATUS=failed` to `OUTCOME=blocked AGENT=architect ACTION="<FINISH_SUMMARY>"`, as it already does for `auto-plan-issue`.
- `auto-fix-issue/SKILL.md`'s coordinator relays the closing report verbatim instead of "the final report (including the PR URL)".

## Solution
Mirror #665's shape for `auto-plan-issue` (commit 8fd226f):
- `auto-fix-issue/steps/run.md`: a `NESTED` paragraph near the top, a `## Closing report` section with `### Nested runs` and `### Failed exits`, and "**fail with** `<step>`" wired into Steps 1–6.
- `auto-fix-issue/steps/open_pr.md`: replace "Report the final PR URL" with the success report; the PR number comes from the `pr_id` stored in `.claude/state/issue-<id>.json` (or the URL tail).
- `auto-fix-issue/SKILL.md`: relay wording.
- `auto-fix-all/steps/process_one_issue.md` §4: `NESTED=true` and `FINISH_*` handling.

Owner: `skill-writer`.
