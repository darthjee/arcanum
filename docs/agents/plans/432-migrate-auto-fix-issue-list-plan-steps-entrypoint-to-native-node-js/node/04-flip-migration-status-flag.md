# Flip the migration-status flag

Change `"auto-fix-issue-list-plan-steps": false` to `true` in `arcanum/_lib/migration-status.json`. This is what makes `engine_dispatch()` prefer the native `AutoFixIssueListPlanSteps` implementation under `engine.mode=native`, falling back to `list_plan_steps_shell.sh` only under `engine.mode=shell`/`docker`.

## Files to Change
- `arcanum/_lib/migration-status.json` — flip the `auto-fix-issue-list-plan-steps` value to `true`.
