# Node Plan: Push helpers push all matching branches on a detached HEAD

Main plan: [plan.md](plan.md)

## Shared contracts

- Refusal message (exact): `refusing to push: no current branch (detached HEAD?)`, thrown as an `Error`.
- `GitClient#requireCurrentBranch()`: resolves to the trimmed branch name; rejects with the refusal error on an empty name.
- `GitClient#pushCurrentBranch()`: `requireCurrentBranch()`, then `git push -u origin <b>:<b>`; resolves to `git push`'s stdout; rejects on any failure (no longer best-effort).
- Entrypoints call `requireCurrentBranch()` right after argument validation, before any `git add`/`git rm`/commit/PR-number resolution/comment post. This order must match the shell side (scripter step 2).
- `AutoMonitorPrMonitorPr` swallows `pushCurrentBranch()` failures silently in its own `try/catch`.
- Refusal: non-zero exit, empty stdout, on both engines.

## Steps

- [01 — Make GitClient strict](node/01-make-gitclient-strict.md)
- [02 — Consolidate the commit/reply commands onto GitClient](node/02-consolidate-commands.md)
- [03 — Keep the monitor best-effort](node/03-monitor-best-effort.md)
- [04 — Parity and regression specs](node/04-parity-and-regression-specs.md)

## CI Checks
- `core/`: `make core-check` (lint + tests; CI: core lint and test jobs)

## Notes
- Step 04's parity specs run the shell scripts too, so they depend on the scripter plan landing first (or in the same branch).
- `createGitFixtureRepo` already builds a bare `origin` (`remotePath`), so the regression fixture only needs a local `main` ahead of `origin/main` plus a detached HEAD; no fixture-helper extension should be needed.
