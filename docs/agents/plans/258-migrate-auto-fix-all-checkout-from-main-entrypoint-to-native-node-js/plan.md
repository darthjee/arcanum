# Plan: Migrate auto-fix-all-checkout-from-main entrypoint to native Node.js

Issue: [258-migrate-auto-fix-all-checkout-from-main-entrypoint-to-native-node-js.md](../issues/258-migrate-auto-fix-all-checkout-from-main-entrypoint-to-native-node-js.md)

## Overview

Migrate `auto-fix-all/scripts/checkout_from_main.sh` to a native `core/lib/AutoFixAllCheckoutFromMain.js`, following the pattern established by `checkout-safe-branch` (#233) and the three already-merged sub-issues in this batch (#254, #255, #256). Unlike those, this entrypoint's shell counterpart can exit `2` (a real merge conflict, distinct from a hard failure) — the native dispatch layer (`core/lib/DispatchFailure.js` / `core/bin/arcanum`) currently only supports exit `1` for its "print to stdout, still fail" shape, so this plan also generalizes that shared mechanism to carry an arbitrary exit code.

## Context

`checkout_from_main.sh <repo_path> <id>` bootstraps or reuses the `issue-<id>` branch merged up to date with `origin/main`, sourcing the not-yet-migrated `arcanum/_lib/git_branch.sh` (`git_branch_fetch_main` / `git_branch_merge_main`) — see `docs/agents/architecture/branch-bootstrap-and-merge-conflicts.md`. Per `script-engine.md`'s "No standalone, wholesale `_lib` migration" rule, the native module re-derives the equivalent git-plumbing logic itself rather than shelling out to the shell helper. No GitHub API calls, no in-batch script dependency (confirmed in the issue and in #252's own dependency check).

## Agents involved

- [node](node.md)
- [scripter](scripter.md)

## Shared contracts

- **Command name**: `auto-fix-all-checkout-from-main` (the `migration-status.json` key and `core/bin/arcanum` `COMMANDS` routing key).
- **Native module**: `core/lib/AutoFixAllCheckoutFromMain.js`, default-exported class `AutoFixAllCheckoutFromMain`, method `run(repoPath, id)` — registered in `core/bin/arcanum`'s `COMMANDS` map as `{ module: 'AutoFixAllCheckoutFromMain.js', method: 'run' }`.
- **Shim**: `auto-fix-all/scripts/checkout_from_main.sh` keeps its filename and `<repo_path> <id>` usage/argument contract unchanged, but becomes a thin `engine_dispatch` shim (mirroring `arcanum/_lib/checkout_safe_branch.sh`'s shape):
  ```bash
  engine_dispatch "$REPO_PATH" auto-fix-all-checkout-from-main "${SCRIPT_DIR}/checkout_from_main_shell.sh" -- "$@"
  ```
  No extra env-var allowlist entries — purely git-based, no `gh`/network calls, same reasoning as `checkout-safe-branch`'s shim.
- **Shell fallback**: the original, unmodified script content moves verbatim to `auto-fix-all/scripts/checkout_from_main_shell.sh` (a straight rename — no behavior change).
- **Output/exit-code contract** (byte-identical between shell and native):
  - Success: stdout `BRANCH=issue-<id>\nSTATUS=ok\n`, exit `0`.
  - Conflict: stdout `BRANCH=issue-<id>\nSTATUS=conflict\n` followed by one conflicted path per line (from `git diff --name-only --diff-filter=U`, in whatever order git reports them), exit `2`. Nothing on stderr in either case.
  - Any other failure (invalid `repoPath`, missing args, an unrecoverable `git fetch` error): thrown `Error`, matching the shell script's own stderr message text, exit `1` (via `core/bin/arcanum`'s existing bare-`Error` path — unchanged).
- **`DispatchFailure` generalization** (node's step 1, a prerequisite for everything else in this issue): `DispatchFailure`'s constructor gains an optional second parameter, `exitCode` (default `1` — every existing caller, e.g. `SpawnIssue.js`, is unaffected). `core/bin/arcanum`'s `dispatch()` catch handler sets `process.exitCode = error.exitCode ?? 1` instead of the hardcoded `1`. `AutoFixAllCheckoutFromMain#run` throws `new DispatchFailure(stdout, 2)` on the conflict path instead of returning a string.
- **Migration-status flip**: `arcanum/_lib/migration-status.json`'s `"auto-fix-all-checkout-from-main"` flips from `false` to `true` — done by scripter, only after node's module and tests land (matching the commit order of the three already-merged sibling migrations: implementation + tests first, then the shim split + status flip).
