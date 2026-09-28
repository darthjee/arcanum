# Per-subcommand migration-status.json keys

In `arcanum/_lib/migration-status.json`, remove `"auto-fix-all-github": true` and add the 7 keys from the shared contracts (`auto-fix-all-github-pr-number`, `-pr-state`, `-pr-merge`, `-cleanup-branch`, `-has-shipit-label`, `-add-tag`, `-remove-tag`), all `true`, keeping the file's existing key ordering convention.

Then regenerate `docs/agents/architecture/entrypoint-migration-status.md` by running `scripts/generate_entrypoint_migration_status.sh`. Never edit it by hand; it's auto-generated. The 7 new rows may show a blank or new "Issue" column, whatever the generator resolves.

## Files to Change
- `arcanum/_lib/migration-status.json` — swap the whole-script key for 7 per-subcommand keys.
- `docs/agents/architecture/entrypoint-migration-status.md` — regenerated, not hand-edited.
