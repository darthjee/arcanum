# Wire every exit path in run.md
In `auto-plan-issue/steps/run.md`, route each exit through the section added in step 01:

- **Step 1**: if no numeric id can be parsed, or `resolve_plan_paths.sh` fails, **fail with** `resolve_plan_paths.sh` (`--issue <id>` only if parsed).
- **Step 1, `PLAN_EXISTS=true`**: still read the existing plan and write nothing, then end with the `success` report:

  ```bash
  ../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill auto-plan-issue --status success --issue <id> \
    --summary "Plan for #<id> already exists; nothing was written." --next "/auto-fix-issue <id>"
  ```

- **Steps 2–4**: if exploration or writing the plan cannot complete, **fail with** the step name (e.g. `write plan`), with `--issue <id>`.
- **Step 5**: if `commit_plan.sh` exits non-zero, **fail with** `commit_plan.sh`, with `--issue <id>`.
- **Step 6**: replace "Report that the plan was written and committed, listing the file(s) created" with the `success` report (keep the "do not ask for confirmation and do not invoke any fix/PR skill" sentence):

  ```bash
  ../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill auto-plan-issue --status success --issue <id> \
    --summary "Plan for #<id> written and committed in <PLAN_DIR>." --next "/auto-fix-issue <id>"
  ```

Each of these call sites notes: with `NESTED=true`, drop `--next` and add `--nested` (link to `#nested-runs`).

## Files to Change
- `auto-plan-issue/steps/run.md` — Steps 1, 5, 6 (and a failure note covering Steps 2–4).
