# Plan: Migrate arcanum-split-issue-create-sub-issue entrypoint to native Node.js

Issue: [259_migrate-arcanum-split-issue-create-sub-issue-entrypoint-to-native-node-js.md](../issues/259-migrate-arcanum-split-issue-create-sub-issue-entrypoint-to-native-node-js.md)

## Overview

Migrate `arcanum-split-issue/scripts/create_sub_issue.sh` to a native Node.js implementation, following the shell → native pattern already applied to the four sibling entrypoints migrated so far (`arcanum-split-issue-create-sub-issue-file`, `arcanum-split-issue-finish`, `auto-fix-all-reply-comment`, `auto-fix-all-cleanup-artifacts`). The **node** agent writes the native `core/lib/ArcanumSplitIssueCreateSubIssue.js` (calling the already-native `SpawnIssue` and `IssueState` classes in-process) plus its unit/parity tests; the **scripter** agent renames the current script to `create_sub_issue_shell.sh` and replaces `create_sub_issue.sh` with a thin `engine_dispatch` shim, mirroring `create_sub_issue_file.sh`'s shape.

## Agents involved

- [node](node.md)
- [scripter](scripter.md)

## Shared contracts

- **Command name**: `arcanum-split-issue-create-sub-issue` — used identically as the `arcanum/_lib/migration-status.json` key, the `core/bin/arcanum` `COMMANDS` map key (node), and the first argument scripter's shim passes to `engine_dispatch` (scripter). All three must match exactly.
- **stdout/exit-code contract** (must be byte-identical between `create_sub_issue_shell.sh` and the native path, per `docs/agents/architecture/script-engine.md`):
  - Success: `STATUS=ok\nID=<new_id>\n`, exit 0.
  - Failure (spawn's retry budget exhausted): `STATUS=failed\n` on stdout, exit 1, no `arcanum: ` stderr prefix — node's `ArcanumSplitIssueCreateSubIssue#run` must throw `core/lib/DispatchFailure.js` with that payload (the same mechanism `SpawnIssue#run` itself already uses), not a plain `Error`.
  - The `Creating sub-issue <count> for issue #<issue_id>: <title>` progress line the shell script prints before delegating — preserve it verbatim in the native implementation so parity holds.
- **Env-var allowlist**: the native command shells out to `gh` in-process (via `SpawnIssue`'s label/comment/link calls), so scripter's shim must forward `HOME` to `engine_dispatch` — the same allowlist entry `arcanum/_lib/spawn_issue.sh`'s own shim already uses, for the same reason (`gh auth token` needs `HOME` once native mode's `env -i PATH="$PATH"` strips the ambient environment).
- **Renamed shell file's own behavior stays untouched**: `create_sub_issue_shell.sh` keeps calling `arcanum/_lib/spawn_issue.sh` (the dispatch shim, not `spawn_issue_shell.sh` directly) and `arcanum/_lib/issue_state.sh` (ditto) exactly as `create_sub_issue.sh` does today — scripter only renames the file and updates its header comment, no logic changes.
