# Node Plan: arcanum-update fails on git installs when untracked files (e.g. synced/) exist

Main plan: [plan.md](plan.md)

## Shared contracts

This agent relies on `bootstrap.sh`'s git-clone behavior as described in `plan.md`'s "Shared contracts" (install detection, env vars, dirty-check semantics, success output).

## Implementation Steps

### Step 1 — Regression spec for bootstrap.sh's git-clone path
Add `core/spec/bin/arcanumUpdateBootstrapGit_spec.js`. It has to match `spec/support/jasmine.json`'s `bin/**/*_spec.js` glob; it isn't a parity spec, but it exercises a shipped script the same way. Build the fixture offline, following the shape of `core/spec/support/utils/gitFixtureRepo.js` (extend it, or add a sibling helper under `core/spec/support/`):

1. A bare `remote.git` plus a seed repo. The seed commits the real `arcanum/update/bootstrap.sh` (copied from the repo root) and a tracked `README.md`, then tags `v1`. It then makes a second commit and tags `v2`, and pushes `main` with `--tags`.
2. Clone into `<tmp>/install` and `git checkout v1`, so the clone has `.git` and no `arcanum.json`.
3. Run `bash <install>/arcanum/update/bootstrap.sh` with env `ARCANUM_VERSION=v2`, `ARCANUM_ASSUME_YES=1`, `ARCANUM_REPO=test/arcanum`, and fixed git author/committer vars.

Cases:
- **Untracked file only** (`synced/.bucket-x` plus `synced/sub/file`): exits 0, stderr contains `arcanum updated to v2`, and `git describe --tags --exact-match` in the clone is `v2`.
- **Modified tracked file** (edit `README.md`): exits 1, stderr contains `has uncommitted changes`, and HEAD stays at `v1`.
- **Staged change** (add a new file with `git add`): exits 1 with the same error.
- **Already on target:** with `ARCANUM_VERSION=v1`, exits 0 with `Already on v1.`

Clean up temp dirs in `afterEach`/`finally`. Use `createTempDir`/`removeTempDir` from `core/spec/support/utils/tempDir.js`.

## Files to Change
- `core/spec/bin/arcanumUpdateBootstrapGit_spec.js` — new spec
- `core/spec/support/utils/gitFixtureRepo.js` or a new helper under `core/spec/support/` — tagged-install fixture builder

## CI Checks
- `core`: `yarn test` (CI job step "Run tests with coverage") and `yarn lint` (CI job step "Lint"), run from `core/`

## Notes
- The untracked-file case fails against the current `bootstrap.sh` and passes after the scripter's change, so it works as the regression guard.
- Reuse the existing `detect-non-literal-fs-filename` false-positive comment pattern (issue #460) wherever `fs` calls take temp-dir paths.
