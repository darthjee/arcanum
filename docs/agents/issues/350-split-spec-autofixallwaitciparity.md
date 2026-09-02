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

New module `core/spec/support/factories/autoFixAllWaitCiParitySetup.js` — the `*ParitySetup.js`
name matches the existing sibling convention (`githubParitySetup.js`, `queueParitySetup.js`),
not the originally-proposed `autoFixAllWaitCiParity.js`.

The module holds `seedGithubLikeRepo` and `seedIgnoredCheckPatterns`, imported by
`preconditions_spec.js` and `ci_outcomes_spec.js`. Behavior copied verbatim. Two corrections
to the original plan, found by comparing against the two existing splits it's meant to mirror:

- **Don't duplicate `runCommand`.** The current local `runCommand` in
  `autoFixAllWaitCiParity_spec.js` is byte-identical to the one already exported by
  `core/spec/support/utils/runCommand.js`, which also exports `REPO_ROOT`, `NATIVE_BIN`, and
  `FAKE_FETCH_PRELOAD` — the same constants this file currently redefines locally. Both
  `githubParitySetup.js` and `queueParitySetup.js` import these from that shared util instead
  of redefining them; the new module (and the three split spec files) should do the same,
  rather than moving a second copy of `runCommand` into `autoFixAllWaitCiParitySetup.js`.
- **Keep `seedEngineMode` local to `engine_dispatch_spec.js`.** It's only used by the
  `engine_dispatch` scenario (never by preconditions or CI outcomes), and the existing
  `autoFixAllGithubParity/engine_dispatch_spec.js` keeps its own equivalent helper
  (`seedEngineMode`) local rather than sharing it — this split should follow the same
  precedent instead of adding it to the shared module.

This stays a minimal, low-risk split (no new `setupParityTest()`-style orchestrator, unlike
`githubParitySetup.js`/`queueParitySetup.js`) — introducing one is a separate, larger decision
left out of scope here (see below).

### Done when

- `autoFixAllWaitCiParity_spec.js` is gone; the three new files exist with every `it` from the
  original, unchanged, distributed per the split axis above.
- `autoFixAllWaitCiParitySetup.js` exists holding `seedGithubLikeRepo` and
  `seedIgnoredCheckPatterns`; `preconditions_spec.js` and `ci_outcomes_spec.js` import from it
  (no copy-pasted helpers). `runCommand`/`REPO_ROOT`/`NATIVE_BIN`/`FAKE_FETCH_PRELOAD` are
  imported from `core/spec/support/utils/runCommand.js` (not redefined locally, not duplicated
  in the new module). `seedEngineMode` stays local to `engine_dispatch_spec.js`.
- `make core-test` passes with the same total spec count as before, and `make core-lint` is
  clean.

### Out of scope

- Any change to `wait_ci_shell.sh`, `wait_ci.sh`, or the native `auto-fix-all-wait-ci`
  implementation.
- Splitting the sibling `autoFixAllWaitCiAndMergeParity_spec.js` — a separate issue.
- Introducing a `setupParityTest()`-style orchestrator in `autoFixAllWaitCiParitySetup.js`
  (as `githubParitySetup.js`/`queueParitySetup.js` both have) — a larger, separate decision.

## Benefits

- Each file covers one coherent concern (validation vs. CI outcomes vs. shim routing).
- Shared setup lives in one reusable place instead of being duplicated.
- Pure navigability improvement — no behavior or coverage change, low review risk.
