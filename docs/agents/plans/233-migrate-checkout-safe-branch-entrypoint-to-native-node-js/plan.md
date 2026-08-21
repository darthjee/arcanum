# Plan: Migrate checkout-safe-branch entrypoint to native Node.js

Issue: [233-migrate-checkout-safe-branch-entrypoint-to-native-node-js.md](../../issues/233-migrate-checkout-safe-branch-entrypoint-to-native-node-js.md)

## Overview

`core/lib/SafeBranch.js` already implements the checkout logic (dirty-tree guard, fetch+prune, checkout to the configured safe branch) and is reused internally by `ResolveAndFetch.js`, but it is not yet exposed as its own CLI command, and no code path replicates `repo_path_enter`'s repo-path validation. `node` adds a shared `RepoPath.js` validation helper and wires a `checkout-safe-branch` command into `core/bin/arcanum`; `scripter` follows the established shim pattern from #227 (`arcanum/_lib/resolve_id_and_file.sh`) to turn `arcanum/_lib/checkout_safe_branch.sh` into an `engine_dispatch` shim, flips the migration-status flag, and regenerates the migration-status doc.

## Agents involved

- [node](node.md)
- [scripter](scripter.md)

## Shared contracts

- **Command key**: the string `checkout-safe-branch` is the single identifier shared across three places and must match byte-for-byte: `core/bin/arcanum`'s `COMMANDS` registry key (node), the `engine_dispatch` call's `<command>` argument inside the new shim (scripter), and the key scripter flips in `arcanum/_lib/migration-status.json`.
- **Shell script path for parity**: node's parity test (`core/spec/bin/checkoutSafeBranchParity_spec.js`) invokes the shell implementation directly at `arcanum/_lib/checkout_safe_branch_shell.sh` — the renamed file scripter creates — NOT the `checkout_safe_branch.sh` shim (that would make the test circular, per the existing `resolveIdAndFileParity_spec.js`/`resolveAndFetchParity_spec.js` convention).
- **Output/exit-code contract** (unchanged from the current shell behavior, must hold for both the renamed shell script and the native path):
  - Success: `BRANCH=<resolved branch>\n` to stdout, exit 0.
  - Dirty tracked-file working tree: error to stderr (message from `safe_branch.sh`), exit 1.
  - Missing/invalid `repo_path`: error to stderr (message from `repo_path_enter` — `Error: repo_path is required`, `Error: not a directory: <path>`, or `Error: not a git repository: <path>`), exit 1. `RepoPath.js` (node) must reproduce these three messages exactly.
- **No env-var allowlist needed**: `checkout-safe-branch` is purely filesystem/git-based (like `resolve-id-and-file`), so scripter's shim passes no env vars to `engine_dispatch` (just `-- "$@"`), and node's native path has no environment dependency to account for.
