# Flip migration status and regenerate the status doc

Land this only once node's commands are registered and their parity specs pass.

- In `arcanum/_lib/migration-status.json`, delete `"init-claude-write-label-config": false`. Add `"init-claude-write-label-config-add": true`, `"init-claude-write-label-config-remove": true` and `"init-claude-write-label-config-replace": true`, keeping the file's key ordering convention. Set `"init-claude-sync-labels": true`.
- Run `scripts/generate_entrypoint_migration_status.sh` and commit the regenerated doc.

## Files to Change
- `arcanum/_lib/migration-status.json`
- `docs/agents/architecture/entrypoint-migration-status.md` — regenerated
