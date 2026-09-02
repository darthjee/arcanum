# Issue: Split spec AutoFixAllWaitCiParity

## Description

`core/spec/bin/autoFixAllWaitCiParity_spec.js` is 431 lines — the largest spec file in
`core/spec`. It's a shell-vs-native parity suite for the `auto-fix-all-wait-ci` migrated
entrypoint, covering 8 top-level `describe` blocks: three argument/repo-path validation
scenarios, a "no PR found" scenario, three CI-outcome scenarios (passing PR, failing PR, PR
with an ignored-pattern check-run), and a 2-test "engine_dispatch routing" section that
exercises the real `wait_ci.sh` shim directly. On top of that, roughly 100 lines of shared
local helpers (`runCommand`, `seedGithubLikeRepo`, `seedIgnoredCheckPatterns`,
`seedEngineMode`) precede the describes.

The entrypoint under test (`auto-fix-all/scripts/wait_ci_shell.sh` / `wait_ci.sh`) is
unchanged and out of scope here — this is spec-only reorganization, same shape as issue #347.

## Problem

One large file mixes three unrelated concerns (precondition/validation failures, CI-outcome
accounting, and engine_dispatch shim routing), making it hard to navigate. Its local helpers
are only usable within this one file, so any split would duplicate them unless extracted.

## Solution

Spec-only reorganization. No changes to `wait_ci_shell.sh`, `wait_ci.sh`, or any native
counterpart. No assertions change — every `it` moves verbatim.

### Split into 3 files

New directory `core/spec/bin/autoFixAllWaitCiParity/`, mirroring the existing
`autoFixAllQueueParity/` / `autoFixAllGithubParity/` split convention (the original monolith
is deleted):

| New spec file | Covers (describe blocks) |
|---|---|
| `preconditions_spec.js` | `a missing required argument`, `a present-but-non-directory repo_path`, `a non-git repo_path`, `no pull request found for the current branch` |
| `ci_outcomes_spec.js` | `a passing PR`, `a failing PR`, `a PR with an ignored-pattern check-run alongside a real one` |
| `engine_dispatch_spec.js` | `engine_dispatch routing (via the real wait_ci.sh shim)` |

### Extract shared helpers

Move `runCommand`, `seedGithubLikeRepo`, `seedIgnoredCheckPatterns`, and `seedEngineMode`
into a shared support module (e.g. `core/spec/support/factories/autoFixAllWaitCiParity.js`),
imported by all three new files, so the three files don't duplicate the setup. Behavior copied
verbatim.

### Done when

- `autoFixAllWaitCiParity_spec.js` is gone; the three new files exist with every `it` from the
  original, unchanged, distributed per the split axis above.
- The shared-helper module exists and the three specs import from it (no copy-pasted helpers).
- `make core-test` passes with the same total spec count as before, and `make core-lint` is
  clean.

### Out of scope

- Any change to `wait_ci_shell.sh`, `wait_ci.sh`, or the native `auto-fix-all-wait-ci`
  implementation.
- Splitting the sibling `autoFixAllWaitCiAndMergeParity_spec.js` — a separate issue.

## Benefits

- Each file covers one coherent concern (validation vs. CI outcomes vs. shim routing).
- Shared setup lives in one reusable place instead of being duplicated.
- Pure navigability improvement — no behavior or coverage change, low review risk.
