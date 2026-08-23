# Register the command and flip migration status

Wire the new module into the centralized native entrypoint and mark this entrypoint as migrated.

## Files to Change

- `core/bin/arcanum` — add `'auto-fix-all-wait-ci': { module: 'AutoFixAllWaitCi.js', method: 'run' }` to the `COMMANDS` map.
- `arcanum/_lib/migration-status.json` — flip `"auto-fix-all-wait-ci"` from `false` to `true`.
