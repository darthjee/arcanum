# Regenerate entrypoint-migration-status.md

`docs/agents/architecture/entrypoint-migration-status.md` is
`AUTO-GENERATED, DO NOT EDIT BY HAND`. After the `migration-status.json` key
rename (step 03), regenerate it:

```bash
scripts/generate_entrypoint_migration_status.sh
```

Run from the repo root (the script self-locates and takes no arguments). Commit
the resulting diff as-is.

Expected diff: the row keyed `permission-grant` becomes `permission-grant-add`,
and its Issue column changes from `#230` to `#328` — the generator walks
`git log --follow` on `migration-status.json` for the first commit whose snapshot
contains the key, which is now the #328 commit. This flip is accepted (see plan
Notes); do not try to preserve `#230` and do not hand-edit the table.

If the generated file is byte-identical except for that row, that is the correct
outcome. Do not run `scripts/bump-version.sh` (which also regenerates this file
as a side effect) — only the targeted generator.

## Files to Change

- `docs/agents/architecture/entrypoint-migration-status.md` — regenerated output
  (do not hand-edit).
