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

### Split into 4 files

New directory `core/spec/bin/autoFixAllWaitCiAndMergeParity/`, mirroring the existing
`autoFixAllQueueParity/` / `autoFixAllGithubParity/` / (new) `autoFixAllWaitCiParity/` split
convention (the original monolith is deleted):

| New spec file | Covers (describe blocks) |
|---|---|
| `preconditions_spec.js` | `a missing required argument`, `a present-but-non-directory repo_path`, `a non-git repo_path` |
| `ci_passes_merge_spec.js` | `CI passes and the merge succeeds` |
| `ci_fails_spec.js` | `CI fails` |
| `engine_dispatch_spec.js` | `engine_dispatch routing (via the real wait_ci_and_merge.sh shim)` |

### Extract shared helpers

Move `runCommand`, `seedGithubLikeRepo`, and `seedLocalState` into a shared support module
(e.g. `core/spec/support/factories/autoFixAllWaitCiAndMergeParity.js`), imported by all four
new files. Behavior copied verbatim. If issue #350's own `autoFixAllWaitCiParity.js` shared
helper module ships first, prefer extending/reusing it over duplicating near-identical
`runCommand`/`seedGithubLikeRepo` implementations across both modules.

### Done when

- `autoFixAllWaitCiAndMergeParity_spec.js` is gone; the four new files exist with every `it`
  from the original, unchanged, distributed per the split axis above.
- The shared-helper module exists and the four specs import from it (no copy-pasted helpers).
- `make core-test` passes with the same total spec count as before, and `make core-lint` is
  clean.

### Out of scope

- Any change to `wait_ci_and_merge_shell.sh`, `wait_ci_and_merge.sh`, or the native
  `auto-fix-all-wait-ci-and-merge` implementation.
- Issue #350 (the sibling `autoFixAllWaitCiParity_spec.js` split) — tracked separately.

## Benefits

- Each file covers one coherent concern (validation vs. merge outcome vs. shim routing).
- Shared setup lives in one reusable place instead of being duplicated.
- Pure navigability improvement — no behavior or coverage change, low review risk.
