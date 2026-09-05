# Node Plan: Split spec ArcanumUpdateRunUpdate

Main plan: [plan.md](plan.md)

## Steps

- [01 — Extract shared helpers into a factory module](node/01-extract-shared-helpers.md)
- [02 — Split off the `#check` spec file](node/02-split-check-spec.md)
- [03 — Split off the `#apply` spec file](node/03-split-apply-spec.md)
- [04 — Remove the original spec file and verify](node/04-remove-original-spec.md)

## Files to Change

- `core/spec/support/factories/arcanumUpdateRunUpdate.js` — new module holding the 6 shared
  fakes (`fakeExistsSync`, `fakeReadFile`, `fakeExecFileAsync`, `fakeSpawn`, `stubDeps`,
  `catchError`) and the 4 path constants (`REPO_PATH`, `BOOTSTRAP_PATH`, `ARCANUM_JSON_PATH`,
  `GIT_DIR_PATH`), unchanged in behavior from their current inline definitions.
- `core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdateCheck_spec.js` — new file, the
  current `#check` describe block (6 `it`s) plus a two-line import from the factory module.
- `core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdateApply_spec.js` — new file, the
  current `#apply` describe block (4 `it`s) plus a two-line import from the factory module.
- `core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdate_spec.js` — deleted; every `it`
  moved verbatim into one of the two new files above.

## CI Checks

- `core/`: `make core-test` (CI job: `test` in `.circleci/config.yml`) — must pass with the
  same total spec count as before (10 `it`s across the two new files, 0 in the deleted file).
- `core/`: `make core-lint` (CI job: `checks` in `.circleci/config.yml`) — must stay clean.

## Notes

- `ArcanumUpdateRunUpdate.js` itself is not touched — no production code or assertion changes,
  per the issue's explicit scope.
- The `bin/arcanumUpdateRunUpdateParity_spec.js` parity spec is out of scope here — tracked
  separately under issue #353.
- Coverage for `core/lib/commands/arcanum-update/ArcanumUpdateRunUpdate.js` must be unchanged
  after the split (same lines/branches exercised, just from two files instead of one).
