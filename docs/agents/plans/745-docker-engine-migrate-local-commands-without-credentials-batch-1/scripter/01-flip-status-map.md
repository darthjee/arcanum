# Flip the status map

Set each of the 29 batch-1 keys in `arcanum/_lib/migration-status.json` from `"native"` to `"docker"`, including `dispatch-fixture-crash` and the native-only `init-claude-set-next-step-auto`. Then run `scripts/generate_entrypoint_migration_status.sh` to regenerate the status table, and commit the generated file without hand edits.

## Files to Change

- `arcanum/_lib/migration-status.json`: 29 values `"native"` → `"docker"`.
- `docs/agents/architecture/entrypoint-migration-status.md`: regenerated.
