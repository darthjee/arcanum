# Flip migration status and regenerate the doc

In `arcanum/_lib/migration-status.json`, replace `monitor-issues-config`, `monitor-issues-github`, `monitor-issues-monitor-issues` and `monitor-issues-rewrite-queue` with the 8 `true` keys from [plan.md](../plan.md#command-names-and-native-invocations). Keep the file's key ordering convention. Then run `scripts/generate_entrypoint_migration_status.sh` and commit the regenerated doc.

Do this last, after the node agent's `commands.js` entries exist. Otherwise `engine.mode=native` routes to commands that aren't registered yet.

## Files to Change
- `arcanum/_lib/migration-status.json` — replace the 4 `false` keys with 8 `true` keys
- `docs/agents/architecture/entrypoint-migration-status.md` — regenerated
