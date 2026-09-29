# Issue: Skill finish: arcanum-split-issue

## Description
Parent: #658. Change `arcanum-split-issue`'s ending so it follows the standard finish defined in `docs/agents/specs/skill-finish.md` (implemented already for `discuss-issue` #660, `enhance-issue` #661 and `plan-issue` #662, which provide the shared `arcanum/_lib/finish_report.sh` and `arcanum/_lib/next_step_prompt.sh`).

## Problem
Today the skill runs `finish.sh` (`Planning` -> `Split`) and then lists the new sub-issues in free text (`steps/push.md`). On partial push failure it reports what was created and what failed, in free text. Declining the split confirmation (`steps/split.md`) ends with ad-hoc prose. There is no standard closing report and no next-step offer.

## Expected Behavior
- Every exit path ends with exactly one report printed by `arcanum/_lib/finish_report.sh --skill arcanum-split-issue`, relayed verbatim:
  - **success**: all sub-issues pushed and `finish.sh` ran. `--issue <parent>`, one `--sub-issue <id>` per sub-issue created in this run, `--label-change <prior>:planning` (derived from `mark-planning` output, as `enhance-issue` does) and `--label-change planning:split`.
  - **declined**:
    - the user rejected the split confirmation in `split.md`: only the `<prior>:planning` label change; local sub-issue files are kept;
    - the user picked **Skip** in `fetch.md` (issue already has tracked sub-issues): lists the existing sub-issues via `--sub-issue` plus the `<prior>:planning` label change.
  - **failed**: `resolve_and_fetch.sh` failure, parent `github.sh update` failure in `discuss.md`, or a partial push failure **only once the user decides to stop** recovering (if retries via `create_sub_issue.sh` eventually succeed, the run continues to the normal success path). Summary names the failed step; lists sub-issues already created and label changes that happened (parent stays `Planning`).
  - No next-step offer after `declined` or `failed`.
- On the **Continue** path (appending to an already-split parent), the success report and the offer include only the sub-issues created in this run.
- On success, the skill runs `next_step_prompt.sh` once with one `--command "/enhance-issue <sub-id>"` per newly created sub-issue (all in one prompt), handling `yes`/`no`/`chat`/exit 1 per the spec. On `CHOICE=yes`, each `/enhance-issue <sub-id>` runs in order as a chained top-level run with its own report and offer; each one's chain finishes before the next sub-issue starts.
- `arcanum-split-issue` is never run nested, so no `--merge`/`--nested`.

## Solution
`skill-writer` edits `arcanum-split-issue/steps/fetch.md`, `discuss.md`, `split.md`, `push.md` (and `SKILL.md` if needed) to add a "Closing report" section mirroring `enhance-issue/steps/publish.md`, wire each exit path to it, and replace the free-text sub-issue listing in `push.md` with the report + next-step offer. No new scripts are expected; `finish.sh` keeps doing relabel + cleanup + safe-branch release.

## Benefits
- Consistent, script-rendered ending across all interactive issue skills.
- The user always sees the exact `/enhance-issue <sub-id>` commands to run next, even when declining the offer.

## Acceptance criteria
- [ ] `arcanum-split-issue` ends with the standard closing report on every exit path (success, declined, failed)
- [ ] The success path offers `/enhance-issue <sub-id>` for each new sub-issue in a single `next_step_prompt.sh` call, per the spec's next-step map
