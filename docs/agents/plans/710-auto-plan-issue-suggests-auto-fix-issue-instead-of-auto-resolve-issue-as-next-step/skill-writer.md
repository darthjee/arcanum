# Skill Writer Plan: Planning skills suggest /auto-fix-issue instead of /auto-resolve-issue as next step

Main plan: [plan.md](plan.md)

## Overview
Switch the next-step suggestion after planning from `/auto-fix-issue <id>` to `/auto-resolve-issue <id>` in `auto-plan-issue`, `plan-issue` and `discuss-issue`. Use the plain command, never wrapped in `/loop`. The offer mechanics (`next_step_prompt.sh`, the exit-4 `AskUserQuestion` fallback, chained top-level invocation on yes) stay exactly as they are.

## Context
`/auto-resolve-issue <id>` runs the full pipeline (fix → PR → monitor → merge). Running it on an already-planned issue is safe: its nested `auto-new-issue` and `auto-plan-issue` steps skip an existing issue file or plan (`STATUS=existing` / `PLAN_EXISTS=true`).

## Implementation Steps

### Step 1 — auto-plan-issue: `Next:` line
In `auto-plan-issue/steps/run.md`, replace `--next "/auto-fix-issue <id>"` with `--next "/auto-resolve-issue <id>"` in all three places:
- the `PLAN_EXISTS=true` success report in Step 1
- Step 6's success report
- the "Closing report" template (`[--next "/auto-resolve-issue <id>"]`)

Nested-run behavior (drop `--next`, add `--nested`) is unchanged.

### Step 2 — plan-issue and discuss-issue: implementation offer
- `plan-issue/steps/write_and_confirm.md`: rename the "Next step: auto-fix-issue" heading to "Next step: auto-resolve-issue". Set `next_step_prompt.sh --command "/auto-resolve-issue <id>"`. `CHOICE=yes` invokes `/auto-resolve-issue <id>` inline as a chained top-level run (no `NESTED=true`). The `CHOICE=chat` line becomes "Do not run `auto-resolve-issue` unless the user asks for it in chat."
- `plan-issue/SKILL.md`: in the frontmatter `description`, "offers /auto-fix-issue as the next step" becomes "offers /auto-resolve-issue as the next step". In the body sentence, "the `/auto-fix-issue <id>` offer" becomes "the `/auto-resolve-issue <id>` offer".
- `discuss-issue/steps/discuss_and_save.md`, step 8.8 ("Offer implementation"): same three switches as `plan-issue` (`--command`, the `CHOICE=yes` invocation, the `CHOICE=chat` wording). Also check `discuss-issue/SKILL.md`'s `description` ("offers planning (run nested) followed by implementation"). It names no command, so it should need no change.

## Files to Change
- `auto-plan-issue/steps/run.md`: three `--next` values.
- `plan-issue/steps/write_and_confirm.md`: heading, `--command`, `CHOICE=yes`/`CHOICE=chat` lines.
- `plan-issue/SKILL.md`: frontmatter `description` and body sentence.
- `discuss-issue/steps/discuss_and_save.md`: step 8.8's `--command`, `CHOICE=yes`/`CHOICE=chat` lines.

## Notes
- Do not touch the other `auto-fix-issue` references in `auto-resolve-issue/steps/*.md` (they call `auto-fix-issue`'s scripts/steps directly), nor `discuss_and_save.md` step 8.5's mention of "ready for `auto-fix-all`/`auto-fix-issue` to pick up". Those describe what the pipeline uses, not the suggested next step.
- Verification: `grep -rn "/auto-fix-issue" auto-plan-issue plan-issue discuss-issue` should return nothing.
