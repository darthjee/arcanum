# Split off the `#check` spec file

Create `core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdateCheck_spec.js`. Import
`ArcanumUpdateRunUpdate` and `DispatchFailure` the same way the original spec does, plus the
helpers/constants needed by this block from
`../../../support/factories/arcanumUpdateRunUpdate.js` (`REPO_PATH`, `BOOTSTRAP_PATH`,
`ARCANUM_JSON_PATH`, `GIT_DIR_PATH`, `fakeExistsSync`, `fakeReadFile`, `fakeExecFileAsync`,
`stubDeps`, `catchError` — this block does not use `fakeSpawn`).

Top-level shape:

```js
describe('ArcanumUpdateRunUpdate#check', () => {
  // the 6 `it`s currently under the original file's `describe('#check', ...)` block,
  // moved verbatim (same descriptions, same bodies, same assertions)
});
```

Move all 6 `it`s from the original file's `#check` block (currently lines 116–200) unchanged:
`METHOD=zip`, `METHOD=git` (SSH origin), `METHOD=git` (HTTPS origin), commit-hash fallback,
missing-bootstrap rejection, missing-arcanum-and-git rejection.

## Files to Change

- `core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdateCheck_spec.js` — new file; the
  6 `it`s from the original `#check` block plus the import line described above.
