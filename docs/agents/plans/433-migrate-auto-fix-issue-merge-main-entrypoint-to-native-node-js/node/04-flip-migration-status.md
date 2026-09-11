# Flip the migration-status entry

`arcanum/_lib/migration-status.json` already has an `"auto-fix-issue-merge-main": false` entry (line ~45, added when the #427 batch overview was scaffolded). Flip its value to `true` — this is what makes `engine_dispatch` (via the shim from step 01) actually route to the native path when `engine.mode=native`/`docker`.

## Files to Change

- `arcanum/_lib/migration-status.json` — `"auto-fix-issue-merge-main"` value `false` → `true`.
