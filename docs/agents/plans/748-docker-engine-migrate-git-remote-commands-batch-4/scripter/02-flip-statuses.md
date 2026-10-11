# Flip statuses and regenerate the status table

Set the 10 batch-4 keys to `"docker"` in `arcanum/_lib/migration-status.json`, then regenerate the entrypoint migration status table with `scripts/generate_entrypoint_migration_status.sh`. Update the 10 shim header paragraphs so they say the command runs in the container now (not "once it is").

## Files to Change

- `arcanum/_lib/migration-status.json`
- `docs/agents/architecture/entrypoint-migration-status.md` (generated)
- the 10 shims listed in step 01 (header wording only)
