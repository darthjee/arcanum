# Update migration status and regenerate the status doc

In `arcanum/_lib/migration-status.json`:
- Add `"github-issue-mark-created": true`, `"github-issue-mark-refined": true`, `"github-issue-mark-ready": true`, `"github-issue-mark-enhancing": true`, `"github-issue-mark-planning": true` and `"github-issue-mark-split": true`, next to the existing `github-issue-*` keys.
- Remove `"github-issue": false`. It is not a dispatched command name.

Then run `scripts/generate_entrypoint_migration_status.sh` and commit the regenerated `docs/agents/architecture/entrypoint-migration-status.md`. Check that the `github-issue` pending row is gone and the six new rows show as migrated.

## Files to Change
- `arcanum/_lib/migration-status.json` — add six keys, remove the umbrella key.
- `docs/agents/architecture/entrypoint-migration-status.md` — regenerated.
