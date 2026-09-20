# Issue: Codacy: duplication cluster — CLI parity "missing required argument" boilerplate (6 files)

## Description

Six CLI-parity spec files under `core/spec/bin/` contain near-duplicated
test blocks asserting shell-vs-native parity for invalid/missing
arguments. Codacy flags this as a duplication cluster covering roughly
350 duplicated lines across:

- `core/spec/bin/arcanumSplitIssueCreateSubIssueFileParity/argument_validation_spec.js`
- `core/spec/bin/arcanumSplitIssueCreateSubIssueParity/argument_validation_spec.js`
- `core/spec/bin/arcanumSplitIssuePushSubIssuesParity/argument_validation_spec.js`
- `core/spec/bin/autoFixAllCheckoutFromMainParity/argument_validation_spec.js`
- `core/spec/bin/autoFixAllWaitCiParity/preconditions_spec.js`
- `core/spec/bin/autoFixAllWaitCiAndMergeParity/preconditions_spec.js`

## Problem

Inspecting all six files shows the duplication is actually two distinct
patterns, not one uniform block:

1. **"missing `<argument>`" blocks.** Only in
   `arcanumSplitIssueCreateSubIssueFileParity` (self-duplicated 4x, one
   per required arg) and `arcanumSplitIssueCreateSubIssueParity`
   (self-duplicated 3x). Both use a file-local `runBoth(args, cwd)`
   helper from their own `support/factories/*Setup.js` file.
2. **"repo_path is not a directory" / "repo_path is not a git
   repository" blocks.** Present in **all six** files (2x each) and
   structurally the more consistent duplication cluster, but with two
   different invocation styles:
   - `runBoth(args, cwd)` (same factory helper as above) in 3 files.
   - Direct `runCommand([SHELL_SCRIPT, ...args], cwd)` /
     `runCommand([process.execPath, NATIVE_BIN, '<subcommand>', ...args], cwd)`
     in the other 3 files (`autoFixAllCheckoutFromMainParity`,
     `autoFixAllWaitCiParity`, `autoFixAllWaitCiAndMergeParity`).

Two files don't fit either pattern cleanly:

- `arcanumSplitIssuePushSubIssuesParity` has **no** "missing argument"
  scenario at all — only the directory/git-repo validation blocks.
- `autoFixAllCheckoutFromMainParity`'s missing-argument tests carry
  extra, bespoke stderr-divergence assertions (tied to issue #333 —
  the native dispatcher validates `repo_path` before the `Usage:`
  guard runs) that a fully generic shared block would need to either
  special-case or exclude.

## Solution

- Factor **two** shared examples (co-located under `core/spec/support/`,
  e.g. alongside the existing `support/factories`/`support/utils`
  helpers):
  - `itRejectsMissingArgument(description, invoke, argName)` (or
    equivalent) for the "missing `<argument>`" scenario.
  - `itRejectsInvalidRepoPath(invoke)` (or equivalent) for the "repo_path
    is not a directory" / "repo_path is not a git repository" pair of
    scenarios.
- Both take a generic `invoke(args, cwd)` callback — supplied per-file —
  that runs shell+native and returns `{ shell, native }`, so each file's
  existing `runBoth` helper or raw `runCommand([SHELL_SCRIPT, ...])` /
  `runCommand([node, NATIVE_BIN, '<subcommand>', ...])` call keeps
  working unchanged; no invocation-style standardization needed.
- Apply the missing-argument shared example to the 2 files that have
  that scenario (`arcanumSplitIssueCreateSubIssueFileParity`,
  `arcanumSplitIssueCreateSubIssueParity`).
- Apply the directory/git-repo shared example to all 6 files.
- Leave `autoFixAllCheckoutFromMainParity`'s missing-argument tests as
  their own bespoke tests (not folded into the shared example) — they
  assert the extra #333 stderr-divergence behavior beyond the generic
  contract. Its directory/git-repo blocks still move to the shared
  example.

### Acceptance criteria

- [ ] `itRejectsMissingArgument`-equivalent shared example exists and is
      used by `arcanumSplitIssueCreateSubIssueFileParity` and
      `arcanumSplitIssueCreateSubIssueParity`.
- [ ] `itRejectsInvalidRepoPath`-equivalent shared example exists and is
      used by all 6 listed spec files.
- [ ] `autoFixAllCheckoutFromMainParity`'s bespoke #333
      stderr-divergence missing-argument tests are preserved unchanged.
- [ ] The hand-copied scenario blocks replaced by the shared examples
      are removed from each affected file.
- [ ] All six specs pass with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for these six files drops substantially
      after the fix lands.
