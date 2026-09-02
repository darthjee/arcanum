# Issue: Split spec AutoFixAllWaitCiAndMergeParity

## Description

`core/spec/bin/autoFixAllWaitCiAndMergeParity_spec.js` is 366 lines — a shell-vs-native
parity suite for the `auto-fix-all-wait-ci-and-merge` migrated entrypoint, the sibling of
`autoFixAllWaitCiParity_spec.js` (issue #350). It covers 6 top-level `describe` blocks: three
argument/repo-path validation scenarios, "CI passes and the merge succeeds", "CI fails", and a
2-test "engine_dispatch routing" section exercising the real `wait_ci_and_merge.sh` shim. On
top of that, ~130 lines of shared local helpers (`runCommand`, `seedGithubLikeRepo`,
`seedLocalState`) precede the describes.

The entrypoint under test (`wait_ci_and_merge_shell.sh` / `wait_ci_and_merge.sh`) is unchanged
and out of scope — this is spec-only reorganization, same shape as issue #347 and #350.

## Problem

One large file mixes unrelated concerns (precondition/validation failures, merge-outcome
behavior, and engine_dispatch shim routing). Its local helpers are only usable within this one
file, so any split would duplicate them unless extracted.

## Solution

Spec-only reorganization. No changes to `wait_ci_and_merge_shell.sh`, `wait_ci_and_merge.sh`,
or any native counterpart. No assertions change — every `it` moves verbatim.

### Split into 3 files

New directory `core/spec/bin/autoFixAllWaitCiAndMergeParity/`, mirroring the existing
`autoFixAllQueueParity/` / `autoFixAllGithubParity/` / `autoFixAllWaitCiParity/` split
convention (the original monolith is deleted). **Update (reconciled against #350, which
shipped first as PR #370 — see below):** matches #350's own 3-file shape exactly, merging
the two CI-outcome describes into one file rather than keeping them separate:

| New spec file | Covers (describe blocks) |
|---|---|
| `preconditions_spec.js` | `a missing required argument`, `a present-but-non-directory repo_path`, `a non-git repo_path` |
| `ci_outcomes_spec.js` | `CI passes and the merge succeeds`, `CI fails` |
| `engine_dispatch_spec.js` | `engine_dispatch routing (via the real wait_ci_and_merge.sh shim)` |

### Extract shared helpers

**Update (reconciled against #350, which shipped first as PR #370):** #350's actual split
did *not* create a wait-ci-family-specific helpers module for the generic pieces. Instead:

- `runCommand`, `REPO_ROOT`, `NATIVE_BIN`, `FAKE_FETCH_PRELOAD`, `git`, and `seedOriginUrl`
  already live in the fully generic, repo-wide `core/spec/support/utils/runCommand.js` —
  shared by every parity suite (`autoFixAllGithubParity`, `autoFixAllWaitCiParity`, etc.), not
  just this family. The four new files should import these directly from there instead of
  redeclaring them.
- Only the truly suite-specific pieces go into a new small setup module,
  `core/spec/support/factories/autoFixAllWaitCiAndMergeParitySetup.js` (note the `Setup`
  suffix, matching #350's `autoFixAllWaitCiParitySetup.js` naming):
  - `SHELL_SCRIPT` / `SHIM_SCRIPT` (the `wait_ci_and_merge_shell.sh` / `wait_ci_and_merge.sh`
    paths).
  - `seedGithubLikeRepo` — same shape as #350's version but keeps its own
    `FAKE_GITHUB_URL` (`arcanum-wait-ci-and-merge-fixture.git`), since the URL differs per
    suite and isn't itself shared.
  - `seedLocalState` — genuinely new to this suite (writes
    `.claude/state/arcanum-config.json` with `engine.mode`/`git.merge_body_mode`); #350 has no
    equivalent, so this one isn't extended from anywhere, just moved verbatim.
- All four new spec files import from both `core/spec/support/utils/runCommand.js` (generic)
  and the new `autoFixAllWaitCiAndMergeParitySetup.js` (suite-specific) — no copy-pasted
  `runCommand`/`git`/`seedOriginUrl` implementations.

### Done when

- `autoFixAllWaitCiAndMergeParity_spec.js` is gone; the three new files exist with every `it`
  from the original, unchanged, distributed per the split axis above.
- `autoFixAllWaitCiAndMergeParitySetup.js` exists with only the suite-specific helpers
  (`SHELL_SCRIPT`, `SHIM_SCRIPT`, `seedGithubLikeRepo`, `seedLocalState`); the three specs
  import generic helpers from `core/spec/support/utils/runCommand.js` and suite-specific ones
  from the new setup module — no copy-pasted `runCommand`/`git`/`seedOriginUrl`.
- `make core-test` passes with the same total spec count as before, and `make core-lint` is
  clean.

### Out of scope

- Any change to `wait_ci_and_merge_shell.sh`, `wait_ci_and_merge.sh`, or the native
  `auto-fix-all-wait-ci-and-merge` implementation.
- Issue #350 (the sibling `autoFixAllWaitCiParity_spec.js` split) — already shipped as PR
  #370; this issue's plan above was reconciled against that shipped implementation rather than
  guessing ahead of it.

## Benefits

- Each file covers one coherent concern (validation vs. merge outcome vs. shim routing).
- Shared setup lives in one reusable place instead of being duplicated.
- Pure navigability improvement — no behavior or coverage change, low review risk.
