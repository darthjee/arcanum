# Skill-writer Plan: Return to the safe branch whenever a run does not continue to the next step

Main plan: [plan.md](plan.md)

## Shared contracts

`auto_next.sh` stdout forms and `run.md` consumption rules from [plan.md](plan.md#shared-contracts):

- `CHAIN=yes` [+ `CLEAR=true`] + `READY=<b>`
- `CHAIN=no` + `REASON=config` + `READY=<b>` + `RELEASED=<b>`
- `CHAIN=no` + `REASON=push|branch`

## Implementation Steps

### Step 1 — Update `auto-plan-issue/steps/run.md`

- Auto-next section:
  - Describe the new flow: always pushes and marks Ready when on `issue-<id>`, and releases to the safe branch on `REASON=config`. Describe the new output lines.
  - `READY=true` → add `--label-change refined:ready` to the success report.
  - `RELEASED=false` → after the report, one line saying the release to the safe branch was refused, quoting stderr.
  - `REASON=push` now means the push failed whether or not it would have chained, and the run stays on `issue-<id>`.
- Closing report section: replace "It changes no labels, so `--label-change` is never passed" with the `READY=true` rule (top-level only; nested runs still never pass it).
- Step 1's "plan already exists" exit and Step 6 already go through Auto-next. Just make sure the wording covers both.

### Step 2 — Update `auto-plan-issue/SKILL.md` and `discuss-issue/steps/discuss_and_save.md`

- `auto-plan-issue/SKILL.md`: the `AUTO_NEXT` / `AUTO_CLEAR` coordinator rules are unchanged. Only adjust any prose saying the skill changes no labels or never moves the branch.
- `discuss-issue/steps/discuss_and_save.md`, "`CHOICE=yes` with `CLEAR=true` — hand off planning": add a note that the top-level `auto-plan-issue` now owns the plan push, the `Refined` → `Ready` swap and the release when it does not chain.

## Files to Change

- `auto-plan-issue/steps/run.md` — Auto-next + Closing report.
- `auto-plan-issue/SKILL.md` — prose only, if needed.
- `discuss-issue/steps/discuss_and_save.md` — hand-off note.

## Notes

- Keep all branching logic in `auto_next.sh`. The markdown only maps output lines to report flags and notes, with no inline bash beyond the existing single call.
