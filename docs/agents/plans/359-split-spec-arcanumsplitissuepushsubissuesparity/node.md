# node Plan: Split spec ArcanumSplitIssuePushSubIssuesParity

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Extract shared helpers into a setup module

Create `core/spec/support/factories/arcanumSplitIssuePushSubIssuesParitySetup.js`, following
the exact shape of `core/spec/support/factories/arcanumSplitIssueCreateSubIssueParitySetup.js`
(same `SHELL_SCRIPT`/`NATIVE_BIN`/`REPO_ROOT` resolution pattern, same JSDoc style). Move these
four helpers out of `arcanumSplitIssuePushSubIssuesParity_spec.js` verbatim (only updating
paths/names for `push_sub_issues_shell.sh` / `arcanum-split-issue-push-sub-issues`):

- `runCommand`
- `runBoth`
- `writeSubIssueFile`
- `seedZeroRetryRepo`

Export `SHELL_SCRIPT`, `NATIVE_BIN`, and `ISSUE_ID` as well (needed directly by
`push_behavior_spec.js` for the last test, which calls `runCommand` twice with explicit
`SHELL_SCRIPT`/`NATIVE_BIN` args instead of going through `runBoth`). Do not re-export
`createGitFixtureRepo`, `createTempDir`, or `removeTempDir` — those stay imported directly from
`support/utils/` in each spec file that needs them, matching the precedent in
`arcanumSplitIssueCreateSubIssueParity/argument_validation_spec.js`.

### Step 2 — Split into two spec files and delete the original

Create directory `core/spec/bin/arcanumSplitIssuePushSubIssuesParity/` with two files, each
carrying its own header comment (adapted from the original monolith's, trimmed to what's
relevant to that file's describe blocks) plus the module-level JSDoc for anything it still
declares locally:

- **`argument_validation_spec.js`** — the two hard-failure `describe` blocks, verbatim:
  - `a present-but-non-directory repo_path (hard failure)`
  - `a non-git repo_path (hard failure)`

  Imports `runCommand`, `runBoth` from the new setup module; `createTempDir`/`removeTempDir`
  directly from `../../support/utils/tempDir.js`. (`createGitFixtureRepo` is not needed here —
  both scenarios use `createTempDir`, not a git fixture repo.)

- **`push_behavior_spec.js`** — the two behavioral `describe` blocks, verbatim:
  - `zero matching files`
  - `the "stops at first failure" contract (plan-issues.max-retry-count: 0)`

  Imports `runCommand`, `runBoth`, `writeSubIssueFile`, `seedZeroRetryRepo`, `SHELL_SCRIPT`,
  `NATIVE_BIN`, `ISSUE_ID` from the new setup module; `createGitFixtureRepo` directly from
  `../../support/utils/gitFixtureRepo.js`; `mkdir`/`writeFile` from `node:fs/promises` and
  `path` from `node:path` (needed by the first `zero matching files` test, which writes an
  unrelated file directly).

Delete `core/spec/bin/arcanumSplitIssuePushSubIssuesParity_spec.js`.

Every `it` body moves unchanged — no assertion, fixture, or expectation is edited.

## Files to Change

- `core/spec/support/factories/arcanumSplitIssuePushSubIssuesParitySetup.js` — new: shared
  `runCommand`, `runBoth`, `writeSubIssueFile`, `seedZeroRetryRepo` helpers plus
  `SHELL_SCRIPT`/`NATIVE_BIN`/`ISSUE_ID` exports.
- `core/spec/bin/arcanumSplitIssuePushSubIssuesParity/argument_validation_spec.js` — new: the
  two repo-path precondition scenarios.
- `core/spec/bin/arcanumSplitIssuePushSubIssuesParity/push_behavior_spec.js` — new: the
  zero-matching-files and stops-at-first-failure scenarios.
- `core/spec/bin/arcanumSplitIssuePushSubIssuesParity_spec.js` — deleted (content redistributed
  above).

## CI Checks

- `core`: `make core-test` (CI job: `test`)
- `core`: `make core-lint` (CI job: `checks`)

## Notes

- Purely mechanical: no change to `arcanum-split-issue/scripts/push_sub_issues_shell.sh` or the
  native `arcanum-split-issue-push-sub-issues` implementation.
- Verify total spec/`it` count is unchanged after the split (4 `it`s total, same as the
  original file: 2 in `zero matching files`, 1 in `the "stops at first failure" contract`, 1
  each in the two hard-failure describes).
