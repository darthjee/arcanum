# Node Plan: Split spec SpawnIssue

Main plan: [plan.md](plan.md)

## Steps

- [01 — Extract shared helpers into a factory module](node/01-extract-shared-helpers.md)
- [02 — Split off the retry spec file](node/02-split-retry-spec.md)
- [03 — Split off the post-create spec file](node/03-split-post-create-spec.md)
- [04 — Split off the argument-validation spec file](node/04-split-argument-validation-spec.md)
- [05 — Remove the original spec file and verify](node/05-remove-original-spec.md)

## Files to Change

- `core/spec/support/factories/spawnIssue.js` — new module holding `stubDeps(overrides)`,
  `buildContext(repoPath, opts)`, and the `REPO_REF`/`DOMAIN`/`CREATE_OUTPUT`/`USAGE`
  constants, unchanged in behavior from their current inline definitions (see step 01 for the
  one required signature adjustment).
- `core/spec/lib/commands/shared/SpawnIssueRetry_spec.js` — new file, `SpawnIssue#run (retry
  behavior)`: the current `retry exhaustion` (3 `it`s) and `retry then success` (1 `it`)
  blocks.
- `core/spec/lib/commands/shared/SpawnIssuePostCreate_spec.js` — new file, `SpawnIssue#run
  (post-create side effects)`: the current `delegation to LabelApplicator/IssueLinker` (2
  `it`s) and `scratch-file cleanup failure` (1 `it`) blocks.
- `core/spec/lib/commands/shared/SpawnIssueArgumentValidation_spec.js` — new file,
  `SpawnIssue#run (argument validation)`: the current `argument validation` block (3 `it`s).
- `core/spec/lib/commands/shared/SpawnIssue_spec.js` — deleted; every `it` moves verbatim into
  one of the three files above.

## CI Checks

- `core/`: `make core-test` (CI job: `test` in `.circleci/config.yml`) — must pass with the
  same total spec count as before (10 `it`s across the three new files, 0 in the deleted
  file).
- `core/`: `make core-lint` (CI job: `checks` in `.circleci/config.yml`) — must stay clean.

## Notes

- `SpawnIssue.js` and its collaborators (`LabelApplicator`, `IssueLinker`) are not touched —
  no production code or assertion changes, per the issue's explicit scope.
- `bin/spawnIssueParity_spec.js` (parity spec) and `LabelApplicator_spec.js`/
  `IssueLinker_spec.js` are out of scope, per the issue.
- Coverage for `core/lib/commands/shared/SpawnIssue.js` must be unchanged after the split
  (same lines/branches exercised, just from three files instead of one).
