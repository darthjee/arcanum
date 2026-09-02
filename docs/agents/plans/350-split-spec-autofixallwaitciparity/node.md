# Node Plan: Split spec AutoFixAllWaitCiParity

Main plan: [plan.md](plan.md)

## Overview

`core/spec/bin/autoFixAllWaitCiParity_spec.js` mixes three unrelated concerns —
precondition/validation failures, CI-outcome accounting, and `engine_dispatch` shim routing —
behind ~100 lines of shared local helpers. Split it into three files under a new
`core/spec/bin/autoFixAllWaitCiParity/` directory, extracting only the helpers that are
genuinely shared across more than one of those files into a new
`core/spec/support/factories/autoFixAllWaitCiParitySetup.js` module, and reusing the existing
`core/spec/support/utils/runCommand.js` util instead of duplicating it. No assertions change —
every `it` moves verbatim; the entrypoint under test (`wait_ci_shell.sh`/`wait_ci.sh`) is
untouched.

## Context

The monolith currently defines 4 local helpers before its describes: `runCommand`,
`seedGithubLikeRepo`, `seedIgnoredCheckPatterns`, `seedEngineMode`. Comparing against the two
existing splits this issue mirrors (`autoFixAllGithubParity/`, `autoFixAllQueueParity/`)
surfaced two corrections to fold in during the split, both already reflected in the issue and
in the steps below:

- `runCommand` (plus `REPO_ROOT`/`NATIVE_BIN`/`FAKE_FETCH_PRELOAD`) is byte-identical to what
  `core/spec/support/utils/runCommand.js` already exports — `githubParitySetup.js` and
  `queueParitySetup.js` both import from there instead of redefining these. This split does
  the same, instead of moving a second copy into the new factory module.
- `seedEngineMode` is only used by the `engine_dispatch` describe block (never by preconditions
  or CI outcomes). `autoFixAllGithubParity/engine_dispatch_spec.js` keeps its own equivalent
  helper local rather than sharing it — this split follows the same precedent, so
  `seedEngineMode` stays local to `engine_dispatch_spec.js`, not in the shared module.

`seedGithubLikeRepo` and `seedIgnoredCheckPatterns` genuinely are shared across 2+ of the new
files (see the per-step breakdown below), so those two move into the new factory module. The
factory module also re-exports `SHELL_SCRIPT` (the `wait_ci_shell.sh` path) since both
`preconditions_spec.js` and `ci_outcomes_spec.js` need it — `SHIM_SCRIPT` (`wait_ci.sh`) stays
local to `engine_dispatch_spec.js`, the only file that uses it, same reasoning as
`seedEngineMode`.

No `setupParityTest()`-style orchestrator is introduced (out of scope per the issue).

## Steps

- [01 — Add the shared parity-setup module](node/01-add-shared-parity-setup-module.md)
- [02 — Split out preconditions_spec.js](node/02-split-preconditions-spec.md)
- [03 — Split out ci_outcomes_spec.js](node/03-split-ci-outcomes-spec.md)
- [04 — Split out engine_dispatch_spec.js and delete the monolith](node/04-split-engine-dispatch-spec-and-delete-monolith.md)
- [05 — Verify spec count and lint](node/05-verify-spec-count-and-lint.md)

## CI Checks

- `core/`: `make core-test` (must pass with the same total spec count as before the split) and
  `make core-lint` (must be clean).

## Notes

- Steps 01–04 leave both the old monolith and the new files on disk simultaneously until step
  04 deletes the monolith — this keeps every intermediate state runnable via
  `make core-test`, in case the implementing agent wants to check progress mid-way (not
  required, just possible).
- Do not touch `auto-fix-all/scripts/wait_ci_shell.sh`, `auto-fix-all/scripts/wait_ci.sh`, or
  any native `auto-fix-all-wait-ci` implementation code — out of scope.
- Do not touch the sibling `autoFixAllWaitCiAndMergeParity_spec.js` — a separate issue.
