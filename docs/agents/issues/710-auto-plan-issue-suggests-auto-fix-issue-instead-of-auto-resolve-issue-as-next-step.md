# Issue: Planning skills suggest /auto-fix-issue instead of /auto-resolve-issue as next step

## Problem
After planning, three skills suggest `/auto-fix-issue <id>` as the next step. The expected next step is `/auto-resolve-issue <id>`. It takes the planned issue through the full pipeline (fix → PR → monitor → merge), not just the implementation.

- `/auto-plan-issue`: its closing report prints `Next: /auto-fix-issue <id>` (`auto-plan-issue/steps/run.md`: the "plan already exists" report in Step 1, Step 6's report, and the "Closing report" template).
- `/plan-issue`: offers `/auto-fix-issue <id>` via `next_step_prompt.sh` (`plan-issue/steps/write_and_confirm.md`, "Next step: auto-fix-issue" section). It also mentions the offer in `plan-issue/SKILL.md`'s frontmatter `description` and body.
- `/discuss-issue`: after the nested planning, offers `/auto-fix-issue <id>` (`discuss-issue/steps/discuss_and_save.md`, step 8.8).

`docs/agents/architecture/skill-finish.md` documents all three (the next-step table rows for `discuss-issue`, `plan-issue` and `auto-plan-issue`, plus the `discuss-issue` two-phase-ending prose).

## Expected Behavior
- `/auto-plan-issue <id>` (top-level, non-nested) ends with `Next: /auto-resolve-issue <id>`, both when it writes a new plan and when a plan already exists. Nested runs are unchanged: they still drop `--next`.
- `/plan-issue <id>` offers `/auto-resolve-issue <id>`. On `CHOICE=yes` it invokes `/auto-resolve-issue <id>` inline as a chained top-level run, the same way it chains `/auto-fix-issue` today.
- `/discuss-issue <id>`'s second offer (after planning) is `/auto-resolve-issue <id>`, with the same chained invocation on yes.
- The command is the plain `/auto-resolve-issue <id>`, not wrapped in `/loop`.

## Solution
- `auto-plan-issue/steps/run.md`: replace `/auto-fix-issue <id>` with `/auto-resolve-issue <id>` in the three `finish_report.sh --next` usages.
- `plan-issue/steps/write_and_confirm.md`: switch the `next_step_prompt.sh --command`, the `CHOICE=yes` invocation, the `CHOICE=chat` wording and the section heading to `/auto-resolve-issue <id>`.
- `plan-issue/SKILL.md`: update the frontmatter `description` and the body sentence that mention the `/auto-fix-issue` offer.
- `discuss-issue/steps/discuss_and_save.md` step 8.8: same switch as `plan-issue`.
- `docs/agents/architecture/skill-finish.md`: update the next-step table rows for `discuss-issue`, `plan-issue` and `auto-plan-issue`, and the `discuss-issue` two-phase-ending prose.
- `docs/agents/architecture/branch-bootstrap-and-merge-conflicts.md` ("Closing checkout"): reword the `/auto-fix-issue` offer/chaining mention. Chaining stays safe, because `auto-resolve-issue`'s per-issue pipeline (`process_one_issue.md`) also re-checks out `issue-<id>` via `checkout_from_main.sh` first.

Running `/auto-resolve-issue` on an already-planned issue is safe: the nested `auto-new-issue` and `auto-plan-issue` steps skip an existing issue file or plan.

## Benefits
- After planning, every planning skill points to the same full autonomous pipeline, so users aren't left to open, monitor and merge the PR by hand.
