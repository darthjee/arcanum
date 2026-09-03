# Issue: Split spec ArcanumSplitIssueCreateSubIssueParity

## Description

`core/spec/bin/arcanumSplitIssueCreateSubIssueParity_spec.js` is 285 lines — a shell-vs-native
parity suite for the `arcanum-split-issue-create-sub-issue` migrated entrypoint, covering 7
top-level `describe` blocks: six argument/file-existence validation scenarios (missing
`repo_path`, missing `issue_id`, missing `sub_issue_file`, non-directory `repo_path`, non-git
`repo_path`, a `sub_issue_file` that doesn't exist) and one substantive behavioral scenario
(the retry-exhausted failure path with `plan-issues.max-retry-count: 0`). Shared local helpers
(`runCommand`, `runBoth`, `writeSubIssueFile`, `seedZeroRetryRepo`) precede the describes.

The entrypoint under test (`create_sub_issue_shell.sh`) is unchanged and out of scope — this
is spec-only reorganization, same shape as issue #347.

## Problem

Six small, mechanically-similar validation scenarios and one substantive behavioral scenario
sit in one file, making the one interesting scenario (retry exhaustion) easy to miss among the
validation boilerplate.

## Solution

Spec-only reorganization. No changes to `create_sub_issue_shell.sh` or the native
`arcanum-split-issue-create-sub-issue` implementation. No assertions change — every `it`
moves verbatim.

### Split into 2 files

New directory `core/spec/bin/arcanumSplitIssueCreateSubIssueParity/`, mirroring the existing
`autoFixAllQueueParity/` / `autoFixAllGithubParity/` split convention (the original monolith
is deleted):

| New spec file | Covers (describe blocks) |
|---|---|
| `argument_validation_spec.js` | `a missing <repo_path> argument`, `a missing <issue_id> argument`, `a missing <sub_issue_file> argument`, `a repo_path that is not a directory`, `a repo_path that is not a git repository`, `a sub_issue_file that does not exist` |
| `retry_exhausted_spec.js` | `the retry-exhausted failure path (plan-issues.max-retry-count: 0)` |

### Header comment distribution

The original's ~40-line header block (parity rationale + coverage note + retry-path
explanation) is split following the `arcanumUpdateRunUpdateParity/` precedent, where each
spec file carries its own header and the support module has no rationale comment:

| Part of the original header | Destination |
|---|---|
| Parity intro (what runs against what, byte-identical stdout/exit, doc refs) | Duplicated near-verbatim atop **both** new files. Each ends with a pointer sentence — `argument_validation_spec.js`: "…covers the argument / file-existence validation scenarios. See `retry_exhausted_spec.js` for the retry-exhausted failure path." and the reciprocal in `retry_exhausted_spec.js`. |
| Coverage note (why the `STATUS=ok` happy path is not exercised here — `spawn_issue.sh` → `curl` can't be intercepted; happy path lives in the node/03 unit tests) | `argument_validation_spec.js` only — it is the suite-wide "what this parity file deliberately omits" note, and that file is where a reader scans for the overall coverage picture. |
| Retry-exhausted explanation (`max-retry-count: 0` skips both retry loops offline; the double-`STATUS=failed` quirk) | `retry_exhausted_spec.js` only, verbatim. |
| Support module | No rationale comment — imports plus exported constants/helpers only, matching the sibling factory. |

### Extract shared helpers

Move `runCommand`, `runBoth`, `writeSubIssueFile`, and `seedZeroRetryRepo` into a shared
support module at `core/spec/support/factories/arcanumSplitIssueCreateSubIssueParitySetup.js`
— the `<camelCaseParityName>ParitySetup.js` naming every #350–#353 split settled on (the
earlier "e.g. …Parity.js" wording is superseded). Behavior copied verbatim.

| Symbol | Disposition | Rationale |
|---|---|---|
| `execFileAsync`, `REPO_ROOT` | module-private | Plumbing; `arcanumUpdateRunUpdateParitySetup.js` keeps its equivalents private too. |
| `SHELL_SCRIPT`, `NATIVE_BIN` | module-private | Only `runCommand` / `runBoth` reference them, and both live in the module. No spec here invokes a script path directly, so nothing needs them exported. |
| `ISSUE_ID` (`'999'`) | exported | Shared test literal used by nearly every `it` in both files (passed to `runBoth`, and in the retry setup); exporting it stops the two specs redefining and drifting. |
| `runCommand`, `runBoth`, `writeSubIssueFile`, `seedZeroRetryRepo` | exported | The four helpers. |

Imports:

- `argument_validation_spec.js` → `runCommand`, `runBoth`, `ISSUE_ID`
- `retry_exhausted_spec.js` → `runCommand`, `runBoth`, `writeSubIssueFile`, `seedZeroRetryRepo`, `ISSUE_ID`

### Done when

- `arcanumSplitIssueCreateSubIssueParity_spec.js` is gone; the two new files exist with every
  `it` from the original, unchanged, distributed per the split axis above.
- The shared-helper module exists and both specs import from it (no copy-pasted helpers).
- `make core-test` passes with the same total spec count as before, and `make core-lint` is
  clean.

### Out of scope

- Any change to `create_sub_issue_shell.sh` or the native
  `arcanum-split-issue-create-sub-issue` implementation.

## Alternatives considered

### Split axis

| Option | Shape | Why not chosen |
|---|---|---|
| Keep the monolith | No change | 285 lines is not huge, but issues #347 / #350–#353 have set a clear precedent that these shell-vs-native parity monoliths get split once they mix validation boilerplate with a substantive case. Skipping the split breaks series consistency for no gain. |
| **2 files: validation vs. behavioral** | `argument_validation_spec.js` (6 blocks) + `retry_exhausted_spec.js` (1 block) | **Chosen.** Minimal cut that solves the stated problem — the retry-exhaustion scenario stops being buried among six near-identical validation blocks. Mirrors `autoFixAllGithubParity/`'s validation-vs-substantive shape. |
| 1 file per `describe` | 7 files | Over-fragmentation: the 6 validation scenarios differ only in which argument is bad / which fixture is used; six near-duplicate files add navigation cost without isolating anything. |
| 3 files (missing-arg / bad-value / behavioral) | `missing_argument_spec.js` (3) + `invalid_repo_or_file_spec.js` (3) + `retry_exhausted_spec.js` (1) | All six validation blocks assert the same contract (empty stdout, nonzero exit, parity); the missing-arg vs. bad-value distinction is not interesting enough to justify a third file. |

### Shared helpers

A shared support module (chosen) matches the established convention — every sibling split extracts helpers to `core/spec/support/factories/*ParitySetup.js`. The rejected alternatives were duplicating the helpers in each file (copy-paste drift) and hosting them in `retry_exhausted_spec.js` for the other file to import (couples one spec file to another).

## Benefits

- The retry-exhaustion scenario is no longer buried among six validation blocks.
- Shared setup lives in one reusable place instead of being duplicated.
- Pure navigability improvement — no behavior or coverage change, low review risk.
