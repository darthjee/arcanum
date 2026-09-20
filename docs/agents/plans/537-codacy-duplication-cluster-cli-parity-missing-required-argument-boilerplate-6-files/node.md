# Node Plan: Codacy: duplication cluster — CLI parity "missing required argument" boilerplate (6 files)

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Add shared CLI-parity validation examples

Create `core/spec/support/sharedExamples/cliParityValidation.js` exporting
two Jasmine-style shared examples:

- `itRejectsMissingArgument(description, invoke, cwdFactory)` — runs
  `invoke` (shell+native) and asserts `native.stdout === shell.stdout`,
  `native.code === shell.code`, `shell.code !== 0`, `shell.stdout ===
  ''`. `description` becomes the `describe(...)` label (e.g. `'a missing
  <repo_path> argument'`); `invoke(cwd)` returns `{ shell, native }`
  (already bound to whatever args/fixture that scenario needs — the
  caller supplies this, so the shared example never constructs args or
  fixtures itself); `cwdFactory()` returns/creates the `cwd` to pass to
  `invoke` and clean up afterwards (mirrors each existing file's own mix
  of `createTempDir`/`createGitFixtureRepo`).
- `itRejectsInvalidRepoPath(invoke)` — registers the two `describe`
  blocks used identically across all six files today: `'a repo_path
  that is not a directory'` / `'a present-but-non-directory repo_path'`
  and `'a repo_path that is not a git repository'` / `'a non-git
  repo_path'` (keep whichever exact wording each file already uses —
  no behavior change to test names), each asserting
  `native.stdout === shell.stdout`, `native.code === shell.code`,
  `shell.code !== 0`, `shell.stdout === ''`, and the
  `Error: not a directory: <path>` / `Error: not a git repository:
  <path>` stderr assertions (`shell.stderr.trim()` exact match,
  `native.stderr.trim()` `toContain`). `invoke(missingPathOrCwd, cwd)`
  is supplied by the caller so it can run through either a file-local
  `runBoth(args, cwd)` helper or a direct
  `runCommand([SHELL_SCRIPT, ...])` / `runCommand([process.execPath,
  NATIVE_BIN, '<subcommand>', ...])` pair unchanged — this shared
  example only owns the assertions, not the invocation mechanics.

Model the exact call signature on whichever of the two invocation styles
(`runBoth`-based vs. raw `runCommand`-based) proves cleanest once the
first file is converted in Step 2 — adjust the signature there if
needed before reusing it across the rest of Step 2/3, since this is the
first time either shared example is used.

### Step 2 — Apply the shared examples across the six files

Replace each file's hand-copied blocks with calls into Step 1's shared
examples, passing that file's own `runBoth`/`runCommand` call as the
`invoke` callback — no file's existing invocation helper changes.

- `arcanumSplitIssueCreateSubIssueFileParity/argument_validation_spec.js`
  and `arcanumSplitIssueCreateSubIssueParity/argument_validation_spec.js`:
  replace their `'a missing <argName> argument'` blocks (4 and 3,
  respectively) with `itRejectsMissingArgument` calls, and their `'a
  repo_path that is not a directory'` / `'...not a git repository'`
  blocks with an `itRejectsInvalidRepoPath` call.
- `arcanumSplitIssuePushSubIssuesParity/argument_validation_spec.js`,
  `autoFixAllWaitCiParity/preconditions_spec.js`,
  `autoFixAllWaitCiAndMergeParity/preconditions_spec.js`: replace their
  `'not a directory'` / `'not a git repository'` blocks with an
  `itRejectsInvalidRepoPath` call. (`arcanumSplitIssuePushSubIssuesParity`
  has no missing-argument scenario — leave it that way.)
- `autoFixAllCheckoutFromMainParity/argument_validation_spec.js`:
  replace only its `'a present-but-non-directory repo_path'` / `'a
  non-git repo_path'` blocks with an `itRejectsInvalidRepoPath` call.
  Leave its two `'missing required args'` tests exactly as they are —
  they assert the bespoke #333 stderr-divergence behavior (native
  validates `repo_path` before the `Usage:` guard runs), which doesn't
  fit the generic missing-argument contract.

After each file, run its spec in isolation to confirm identical
pass/fail behavior and coverage before moving to the next.

## Files to Change

- `core/spec/support/sharedExamples/cliParityValidation.js` — new file,
  `itRejectsMissingArgument` and `itRejectsInvalidRepoPath` shared
  examples.
- `core/spec/bin/arcanumSplitIssueCreateSubIssueFileParity/argument_validation_spec.js`
- `core/spec/bin/arcanumSplitIssueCreateSubIssueParity/argument_validation_spec.js`
- `core/spec/bin/arcanumSplitIssuePushSubIssuesParity/argument_validation_spec.js`
- `core/spec/bin/autoFixAllCheckoutFromMainParity/argument_validation_spec.js`
- `core/spec/bin/autoFixAllWaitCiParity/preconditions_spec.js`
- `core/spec/bin/autoFixAllWaitCiAndMergeParity/preconditions_spec.js`

## CI Checks

- `core`: `yarn test` (CI job: `test`) — must keep passing with unchanged
  coverage (Codacy coverage upload runs off this job).
- `core`: `yarn lint` (CI job: `checks`) — new shared-example file must
  pass ESLint.
- `core`: `yarn duplication` (CI job: `checks`, non-blocking) — expected
  to show the duplication cluster shrink; not a hard gate but is the
  signal this issue is meant to move.

## Notes

- Preserve each scenario's exact `describe`/`it` text so any existing
  test-name-based tooling (coverage reports, CI annotations) isn't
  disrupted — only the block bodies get deduplicated, not their labels.
- `runBoth` in the three factory files
  (`arcanumSplitIssueCreateSubIssueFileParitySetup.js`,
  `arcanumSplitIssueCreateSubIssueParitySetup.js`,
  `arcanumSplitIssuePushSubIssuesParitySetup.js`) and the raw
  `runCommand` calls in the other three files are intentionally left
  untouched — the shared examples adapt to them via the `invoke`
  callback rather than the other way around, per the issue's resolved
  scope.
