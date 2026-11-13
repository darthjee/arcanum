# Node Plan: Add a migration that deletes the legacy auto-fix-all.json and monitor-issues.json

Main plan: [plan.md](plan.md)

## Shared contracts

You can rely on `scripter` producing `arcanum/migrations/repos/next/001.sh` and its manifest entry exactly as described in [plan.md → Shared contracts](plan.md#shared-contracts).

## Implementation Steps

### Step 1 — Add the contract spec
Create `core/spec/bin/migrationsDeleteLegacyConfig_spec.js`, modelled on `core/spec/bin/migrationsMonitorIssuesClearContext_spec.js`: temp-dir repo, `runCommand(['bash', SCRIPT, sub], repoPath)`.

Path rules (from `docs/agents/architecture/per-repo-migrations.md` → "Spec convention"; enforced by `core/spec/bin/migrationSpecReferences_spec.js`):
- Declare `const SCRIPT = path.join(REPO_ROOT, 'arcanum/migrations/repos/next/001.sh');` as a single literal.
- Derive the manifest path as `path.join(path.dirname(SCRIPT), 'migrations.json')`.
- Name the `describe` block without its folder (e.g. `'legacy config files deletion migration'`).

Cases to cover:
- `config` prints exactly `{"skippable": true}\n`, and the manifest entry for `001` matches the shared contract.
- Legacy `auto-fix-all.json` present and namespace missing → `auto-fix-all` is seeded with the legacy content, other keys are preserved, and the legacy file is deleted.
- Namespace already present with a different value (e.g. `["Codacy"]` vs. legacy `["codacy"]`) → the namespace is unchanged and the legacy file is still deleted.
- `monitor-issues.json` present → deleted, and nothing is seeded from it.
- Neither file present → exit 0, and `arcanum-repo-config.json` is not created.
- `.claude/configuration/` still exists after the run.
- Invalid-JSON legacy `auto-fix-all.json` → non-zero exit, and both legacy files are still on disk.
- A second `run` is a no-op (exit 0, same content).

## Files to Change
- `core/spec/bin/migrationsDeleteLegacyConfig_spec.js` — new contract spec.

## CI Checks
- `core`: `cd core && yarn test && yarn lint` (or `make core-test`)

## Notes
- This is not a parity spec: the migration has no native counterpart.
