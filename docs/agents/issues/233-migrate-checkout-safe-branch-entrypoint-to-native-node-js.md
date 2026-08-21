# Issue: Migrate checkout-safe-branch entrypoint to native Node.js

## Description
Part of the entrypoint migration batch tracked in #232 (following #192, #193, #227). Migrates `arcanum/_lib/checkout_safe_branch.sh` — a thin CLI wrapper (`repo_path_enter <repo_path>` then `safe_branch_checkout`) — to native Node.js.

This is wiring, not a fresh build: `core/lib/SafeBranch.js` already implements the checkout logic (dirty-tree error, `git fetch -p`, checkout to the configured safe branch, detached HEAD) and is already used internally by `core/lib/ResolveAndFetch.js`. It just is not exposed as its own CLI command yet.

## Problem
Two gaps stand between `SafeBranch.js` and full parity with the shell wrapper:
1. It is not wired into `core/bin/arcanum`'s `COMMANDS` registry as its own `checkout-safe-branch` command.
2. Neither `SafeBranch.js` nor `ResolveAndFetch.js` replicates `repo_path_enter`'s validation (not-a-directory / not-a-git-repo checks, distinct error messages, exit 1) — required for byte-identical parity with the shell CLI wrapper's `repo_path_enter "$REPO_PATH"` call. This same validation will be needed by the other #232 sub-issues (list-agents, permission-grant, github-issue, issue-state, spawn-issue), so it belongs in a shared place rather than duplicated per command.

## Expected Behavior
Running `core/bin/arcanum checkout-safe-branch <repo_path>` must match `arcanum/_lib/checkout_safe_branch.sh <repo_path>` byte-for-byte:
- Success: `BRANCH=<resolved branch>` to stdout, exit 0.
- Dirty tracked-file working tree: error to stderr (message defined in `safe_branch.sh`), exit 1.
- Missing/invalid `repo_path` (not a directory, or not a git repo): error to stderr (message from `repo_path_enter`), exit 1.

## Solution
- Add a new `core/lib/RepoPath.js` helper replicating `repo_path_enter`'s checks (missing path, not-a-directory, not-a-git-repo — same error messages, exit-1 semantics) as a reusable module the other #232 sub-issues can import.
- Wire `checkout-safe-branch` into `core/bin/arcanum`'s `COMMANDS` registry, routed to `SafeBranch.js`, using `RepoPath.js` for the repo-path validation before checkout.
- Add a parity test at `core/spec/lib/CheckoutSafeBranch_spec.js` (or extend `SafeBranch_spec.js`) running shell vs native with identical inputs, asserting identical stdout + exit code, including the dirty-tree and invalid-repo-path cases.
- Add unit tests for `RepoPath.js` (missing path, non-directory, non-git-repo).
- Flip `checkout-safe-branch` from `false` to `true` in `arcanum/_lib/migration-status.json`.
- Regenerate `docs/agents/architecture/entrypoint-migration-status.md` via `scripts/generate_entrypoint_migration_status.sh`.
- Zero runtime npm dependencies — only built-in Node APIs.

## Benefits
- Continues the native-Node.js entrypoint migration (#192, #193, #227), shrinking the remaining bash surface.
- Delivers `RepoPath.js` as a shared, tested helper the other #232 sub-issues (list-agents, permission-grant, github-issue, issue-state, spawn-issue) can import directly instead of each re-implementing the same validation.
