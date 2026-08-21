# Flip list-agents to true in migration-status.json

Only once `node`'s unit tests and parity test are passing: flip the `"list-agents"` key from `false` to `true` in `arcanum/_lib/migration-status.json`, so `engine_dispatch.sh` actually routes to the native path when `engine.mode=native` is configured.

## Files to Change

- `arcanum/_lib/migration-status.json` — `"list-agents": false` → `"list-agents": true`.
