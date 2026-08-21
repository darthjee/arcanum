# node Plan: Migrate checkout-safe-branch entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Must register the command under the exact key `checkout-safe-branch` in `core/bin/arcanum`'s `COMMANDS` registry.
- `RepoPath.js`'s validation must reproduce `arcanum/_lib/repo_path.sh`'s three error messages exactly: `Error: repo_path is required`, `Error: not a directory: <path>`, `Error: not a git repository: <path>` (stderr, exit 1 — same shape as other migrated entrypoints' error propagation via `core/bin/arcanum`'s top-level `.catch()`, which already writes `arcanum: <message>\n` to stderr and sets exit 1).
- The parity test must exercise `arcanum/_lib/checkout_safe_branch_shell.sh` (scripter creates this renamed file) directly — not the `checkout_safe_branch.sh` shim — to avoid a circular test.

## Implementation Steps

### Step 1 — Add the `RepoPath` validation helper

Add `core/lib/RepoPath.js`, a small native equivalent of `arcanum/_lib/repo_path.sh`'s `repo_path_enter`: given a `repoPath` string, throw an `Error` with the matching message (see Shared contracts above) when the path is empty, not a directory, or not a git repository (`git -C <repoPath> rev-parse --git-dir`, same check the shell version uses); resolve silently otherwise. Model the class shape (constructor-injectable `execFileAsync`, JSDoc) after `core/lib/SafeBranch.js`. Add `core/spec/lib/RepoPath_spec.js` covering all three failure cases plus the pass-through success case.

### Step 2 — Wire the `checkout-safe-branch` command and add parity coverage

Add a `run(repoPath)` method to `core/lib/SafeBranch.js` (or a thin new class, whichever keeps `SafeBranch#checkout` focused on the checkout step alone) that: calls `RepoPath`'s validation first, then performs the existing checkout logic, then returns `BRANCH=<branch>\n` for `core/bin/arcanum` to print — `checkout()`'s internals already resolve the branch via `RepoConfig#getSafeBranch`; make that value available to `run()` (return it from `checkout()`, or resolve it once in `run()` and pass it down). Register `'checkout-safe-branch': { module: 'SafeBranch.js', method: 'run' }` in `core/bin/arcanum`'s `COMMANDS` map.

Add/extend `core/spec/lib/SafeBranch_spec.js` with unit tests for `#run` (validation failure short-circuits before checkout; success returns the `BRANCH=` string). Add `core/spec/bin/checkoutSafeBranchParity_spec.js`, modeled directly on `core/spec/bin/resolveIdAndFileParity_spec.js`: spin up a temp git fixture repo, run `arcanum/_lib/checkout_safe_branch_shell.sh <repo>` and `core/bin/arcanum checkout-safe-branch <repo>` against identical repo states (clean, dirty tracked file, missing path, non-git path), and assert identical stdout + exit code (and stderr message for the hard-failure cases).

## Files to Change

- `core/lib/RepoPath.js` — new repo-path validation helper.
- `core/spec/lib/RepoPath_spec.js` — new unit tests.
- `core/lib/SafeBranch.js` — add `#run`, wire in `RepoPath` validation, expose the resolved branch.
- `core/spec/lib/SafeBranch_spec.js` — extend with `#run` coverage.
- `core/bin/arcanum` — register `checkout-safe-branch` in `COMMANDS`.
- `core/spec/bin/checkoutSafeBranchParity_spec.js` — new parity test (shell vs. native).

## CI Checks

- `core/`: `yarn test` (CI job: `test`)
- `core/`: `yarn lint` (CI job: `checks`)

## Notes

- Depends on scripter's Step 1 (the `checkout_safe_branch_shell.sh` rename) landing before the parity test can pass — coordinate ordering, or land both in the same PR.
