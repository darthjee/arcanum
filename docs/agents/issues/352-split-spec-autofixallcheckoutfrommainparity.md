# Issue: Split spec AutoFixAllCheckoutFromMainParity

## Description

`core/spec/bin/autoFixAllCheckoutFromMainParity_spec.js` is 347 lines — a shell-vs-native
parity suite for the `auto-fix-all-checkout-from-main` migrated entrypoint, covering 7
top-level `describe` blocks: four branch-topology scenarios (fresh branch, existing local
branch merged cleanly, remote-only branch, real merge conflict) and three argument/repo-path
validation scenarios. ~130 lines of shared local helpers (`git`, `runCommand`,
`buildRepoPair`, `runPair`, `seedExistingLocalBranch`, `seedRemoteOnlyBranch`,
`seedConflictingBranch`) precede the describes.

The entrypoint under test (`checkout_from_main_shell.sh`) is unchanged and out of scope —
this is spec-only reorganization, same shape as issue #347.

## Problem

One large file mixes two unrelated concerns (branch-topology/merge behavior vs. argument
validation). Its local helpers are only usable within this one file, so any split would
duplicate them unless extracted.

## Solution

Spec-only reorganization. No changes to `checkout_from_main_shell.sh` or the native
`auto-fix-all-checkout-from-main` implementation. No assertions change — every `it` moves
verbatim.

### Split into 3 files

New directory `core/spec/bin/autoFixAllCheckoutFromMainParity/`, mirroring the existing
`autoFixAllQueueParity/` / `autoFixAllGithubParity/` split convention (the original monolith
is deleted):

| New spec file | Covers (describe blocks) |
|---|---|
| `happy_path_spec.js` | `a fresh branch, with origin/main present (default fixture shape)`, `an existing local branch, merged cleanly with origin/main`, `a remote-only branch (no local ref)` |
| `merge_conflict_spec.js` | `a real merge conflict` |
| `argument_validation_spec.js` | `missing required args`, `a present-but-non-directory repo_path`, `a non-git repo_path` |

### Extract shared helpers

Move `git`, `runCommand`, `buildRepoPair`, `runPair`, `seedExistingLocalBranch`,
`seedRemoteOnlyBranch`, and `seedConflictingBranch` into a shared support module (e.g.
`core/spec/support/factories/autoFixAllCheckoutFromMainParity.js`), imported by
`happy_path_spec.js` and `merge_conflict_spec.js` (the two files that need the git-fixture
helpers; `argument_validation_spec.js` only needs `runCommand`/`createTempDir`). Behavior
copied verbatim.

### Done when

- `autoFixAllCheckoutFromMainParity_spec.js` is gone; the three new files exist with every
  `it` from the original, unchanged, distributed per the split axis above.
- The shared-helper module exists and is imported where needed (no copy-pasted helpers).
- `make core-test` passes with the same total spec count as before, and `make core-lint` is
  clean.

### Out of scope

- Any change to `checkout_from_main_shell.sh` or the native
  `auto-fix-all-checkout-from-main` implementation.

## Benefits

- Each file covers one coherent concern (branch/merge behavior vs. validation).
- Shared git-fixture helpers live in one reusable place instead of being duplicated.
- Pure navigability improvement — no behavior or coverage change, low review risk.
