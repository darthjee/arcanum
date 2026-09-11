# Flip the migration-status flag

Once the native command is registered and tested, flip its entry so `engine_dispatch.sh` actually prefers it under `engine.mode=native`/`docker`.

- Set `"auto-fix-issue-create-branch": true` in `arcanum/_lib/migration-status.json` (currently `false`).

## Files to Change
- `arcanum/_lib/migration-status.json` — flip the `auto-fix-issue-create-branch` value to `true`.
