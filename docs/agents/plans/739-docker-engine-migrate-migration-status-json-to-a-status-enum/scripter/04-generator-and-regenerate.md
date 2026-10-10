# Update the generator and regenerate the status doc

In `scripts/generate_entrypoint_migration_status.sh`:

- table header becomes `| Command | Status | Issue |`;
- each row prints the raw value as `` `<value>` `` (`jq -r --arg k "$key" '.[$k] | tostring'`), so a stray legacy boolean shows as `` `true` `` rather than being hidden;
- the intro paragraph: `Status` is the command's docker-readiness value (`shell`, `native`, `docker`, `host-only`; link to `../specs/docker/dispatch.md#docker-readiness-source-of-truth`). `Issue` is the issue whose commit introduced the key, still never a guess;
- delete the "Native-only commands … never appear in this table." paragraph, and say instead that native-only commands are listed too;
- update the script's own header comment to match. `issue_for_key` is unchanged.

Then run `scripts/generate_entrypoint_migration_status.sh`, after step 01 is committed, and commit the regenerated `docs/agents/architecture/entrypoint-migration-status.md`. Never hand-edit it.

## Files to Change

- `scripts/generate_entrypoint_migration_status.sh` — `Status` column, intro text, drop the native-only note.
- `docs/agents/architecture/entrypoint-migration-status.md` — regenerated output.
