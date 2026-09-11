# Flip the migration-status flag to true

Set `"auto-fix-issue-run-checks"` from `false` to `true` in `arcanum/_lib/migration-status.json` (the key already exists in the map). This is what makes `engine_dispatch.sh` prefer the native `AutoFixIssueRunChecks` implementation under `engine.mode=native`, falling back to `run_checks_shell.sh` only under `engine.mode=shell`/`docker`.

## Files to Change
- `arcanum/_lib/migration-status.json` — flip `"auto-fix-issue-run-checks"` to `true`.
