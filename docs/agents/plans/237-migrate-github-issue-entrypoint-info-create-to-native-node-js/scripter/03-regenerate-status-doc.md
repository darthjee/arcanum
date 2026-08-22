# Regenerate entrypoint-migration-status.md

Run `scripts/generate_entrypoint_migration_status.sh` (no arguments — it self-locates `arcanum/_lib/migration-status.json` and always writes `docs/agents/architecture/entrypoint-migration-status.md`) and commit the regenerated file alongside step 02's `migration-status.json` change.

## Ordering caveat

The generator resolves each key's "introduced by issue #" column by walking `git log --follow` on `migration-status.json` itself, scanning each introducing commit's subject for a `#<digits>` token. That means the two new rows (`github-issue-info`, `github-issue-create`) will only get a populated `#237` issue column **after** step 02's `migration-status.json` change has actually been committed (with `#237` somewhere in the commit subject, per this repo's commit message template) — running the generator before that commit exists, or with a commit subject that doesn't mention `#237`, leaves those rows' issue column blank rather than wrong. Run this step's regeneration as its own commit right after step 02's, not folded into the same commit, so the generator sees step 02's commit in history when it runs.

## Files to Change

- `docs/agents/architecture/entrypoint-migration-status.md` — regenerated (adds `github-issue-info`/`github-issue-create` rows).
