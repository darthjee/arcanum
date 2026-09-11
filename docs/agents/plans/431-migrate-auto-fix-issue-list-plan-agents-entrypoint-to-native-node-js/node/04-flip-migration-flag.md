# Flip the migration-status flag to true

Set `"auto-fix-issue-list-plan-agents": true` in `arcanum/_lib/migration-status.json` (currently `false`). Once flipped, `engine_dispatch.sh` prefers the native `AutoFixIssueListPlanAgents` implementation under `engine.mode=native`, falling back to `list_plan_agents_shell.sh` only under `engine.mode=shell`/`docker`.

## Files to Change
- `arcanum/_lib/migration-status.json` — flip the `auto-fix-issue-list-plan-agents` value from `false` to `true`.
