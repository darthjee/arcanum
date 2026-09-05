# Split off the `#apply` spec file

Create `core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdateApply_spec.js`, following
the same flat top-level `describe('ArcanumUpdateRunUpdate#apply', ...)` convention as
[step 02](02-split-check-spec.md) (see e.g. `core/spec/lib/commands/shared/GithubIssueCreate_spec.js`'s
`describe('GithubIssue#create', ...)` for the established pattern). Import
`ArcanumUpdateRunUpdate` and `DispatchFailure` the same way the original spec does, plus the
helpers/constants needed by this block from
`../../../support/factories/arcanumUpdateRunUpdate.js` (`REPO_PATH`, `BOOTSTRAP_PATH`,
`ARCANUM_JSON_PATH`, `fakeExistsSync`, `fakeReadFile`, `fakeSpawn`, `stubDeps`, `catchError` —
this block does not use `fakeExecFileAsync` or `GIT_DIR_PATH`).

Move all 4 `it`s from the original file's `#apply` block (currently lines 203–268) unchanged:
`RESULT=updated` (spawns bootstrap.sh with `stdio: 'inherit'` and `ARCANUM_ASSUME_YES=1`),
`RESULT=noop` (version unchanged), nonzero-exit rejection, missing-bootstrap rejection
(spawnFn never called).

## Files to Change

- `core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdateApply_spec.js` — new file; the
  4 `it`s from the original `#apply` block plus the import line described above.
