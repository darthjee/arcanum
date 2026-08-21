# Regenerate the entrypoint migration status doc

Run `scripts/generate_entrypoint_migration_status.sh` from the repo root after Step 2's flip, so `docs/agents/architecture/entrypoint-migration-status.md`'s `list-agents` row picks up `Migrated: Yes` and this issue's number, same as #227/#233 did for their own rows. (This doc also self-heals at the next `scripts/bump-version.sh` run, but regenerating it now keeps the committed docs accurate immediately rather than relying on that.)

## Files to Change

- `docs/agents/architecture/entrypoint-migration-status.md` — regenerated output (do not hand-edit; only run the generator script).
