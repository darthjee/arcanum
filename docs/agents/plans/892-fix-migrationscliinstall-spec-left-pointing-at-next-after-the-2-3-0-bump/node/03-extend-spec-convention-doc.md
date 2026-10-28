# Extend the Spec convention doc
In `docs/agents/architecture/per-repo-migrations.md` → "Referencing pending migrations", extend the **Spec convention** bullet, or add sub-bullets under it:

- A spec that also reads a migration's manifest (or needs any other path in the same folder) derives it from the script's literal, e.g. `path.join(path.dirname(SCRIPT), 'migrations.json')` or `path.relative(REPO_ROOT, SCRIPT)`. It never writes `repos/next/migrations.json` as a literal, because the bump only rewrites `repos/next/NNN` references.
- Restate that assembling `'repos', 'next'` segments is forbidden.
- `describe` titles either name the migration without its folder, or get updated by hand at bump, because the bump doesn't rewrite them.
- Enforcement: `core/spec/bin/migrationSpecReferences_spec.js` fails CI on either forbidden pattern. It doesn't detect template literals or variables that hold `'next'`. A spec that genuinely needs the pending `next/` folder globs `repos/*/` or builds fixture folders under a neutral name instead.

## Files to Change
- `docs/agents/architecture/per-repo-migrations.md` — extend the Spec convention and point it at the new convention spec.
