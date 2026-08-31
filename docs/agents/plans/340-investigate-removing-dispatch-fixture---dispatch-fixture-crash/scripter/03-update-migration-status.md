# Remove the migration-status.json entry and regenerate the doc

Remove the `"dispatch-fixture": true` entry from `arcanum/_lib/migration-status.json`, keeping `"dispatch-fixture-crash": true` (out of scope, stays). Then run `scripts/generate_entrypoint_migration_status.sh` to refresh the auto-generated `docs/agents/architecture/entrypoint-migration-status.md` (its `dispatch-fixture` row should disappear; the `dispatch-fixture-crash` row stays), and commit the regenerated doc alongside the JSON change — do not hand-edit the generated `.md` file.

## Files to Change

- `arcanum/_lib/migration-status.json` — remove the `"dispatch-fixture": true` entry.
- `docs/agents/architecture/entrypoint-migration-status.md` — regenerate via `scripts/generate_entrypoint_migration_status.sh` (auto-generated, do not hand-edit).
