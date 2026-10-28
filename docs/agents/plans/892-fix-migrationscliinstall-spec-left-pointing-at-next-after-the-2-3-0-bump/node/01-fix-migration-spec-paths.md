# Fix the migration spec paths and stale titles
Make every migration path in `migrationsCliInstall_spec.js` follow the versioned `SCRIPT` literal, the only one the bump rewrites, so this spec and future bumps can't drift apart:

- `MANIFEST = path.join(path.dirname(SCRIPT), 'migrations.json')`, which now resolves to `repos/2.3.0/migrations.json` and makes the failing expectation pass.
- `SCRIPT_RELATIVE = path.relative(REPO_ROOT, SCRIPT)`, so the fake install's layout matches the real one (`arcanum/migrations/repos/2.3.0/001.sh`) and the header comment (lines 16–18).
- Rename the top-level `describe` (line 83) from `'next/001 arcanum-cli install migration'` to `'2.3.0/001 arcanum-cli install migration'`.
- In `migrationsMonitorIssuesClearContext_spec.js:19`, rename `'monitor-issues clear_context migration (next/001)'` to `'monitor-issues clear_context migration (2.2.0/001)'`.

Update the spec's header comment if it describes `MANIFEST`/`SCRIPT_RELATIVE`. It should say that both are derived from `SCRIPT`.

## Files to Change
- `core/spec/bin/migrationsCliInstall_spec.js` — derive `MANIFEST` and `SCRIPT_RELATIVE` from `SCRIPT`; rename the top-level `describe`.
- `core/spec/bin/migrationsMonitorIssuesClearContext_spec.js` — rename the stale `describe` title.
