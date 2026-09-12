# Flip the migration-status flag

Add `"discuss-issue-render-issue": true` to `arcanum/_lib/migration-status.json`, alongside the other `discuss-issue-*` entries — this is what lets `engine_dispatch.sh` route to the native path instead of silently falling back to shell when `engine.mode=native` is configured.

## Files to Change

- `arcanum/_lib/migration-status.json` — add the `discuss-issue-render-issue: true` entry.
