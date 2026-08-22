# Plan: Migrate arcanum-split-issue-finish entrypoint to native Node.js

Issue: [255-migrate-arcanum-split-issue-finish-entrypoint-to-native-node-js.md](../issues/255-migrate-arcanum-split-issue-finish-entrypoint-to-native-node-js.md)

## Overview

Migrate `arcanum-split-issue/scripts/finish.sh` to a native Node.js implementation, following the shell/native split established by the recently merged entrypoint migrations (#236–#239). `scripter` splits the existing script into a shell implementation plus a thin `engine_dispatch` shim and adds the migration-status flag; `node` writes the native module, wires it into `core/bin/arcanum`, and covers it with unit and shell/native parity tests.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

- **Command name**: `arcanum-split-issue-finish` — the `migration-status.json` key and the `core/bin/arcanum` routing key.
- **CLI usage** (unchanged): `finish.sh <repo_path> <issue_id>`.
- **Output/exit-code contract** (byte-identical between shell and native, enforced by the parity test):
  - stdout: `Deleted:\n  <path>\n  <path>\n...\n` — one `  <path>` line per file removed from `docs/agents/issues/`, first every file matching `<id>-*`, then every file matching `<id>_*` (same two-pass order as the current shell loops) — or `Deleted: (nothing to clean up)\n` when neither glob matches anything — immediately followed by `BRANCH=<branch>\n` from the safe-branch release step.
  - exit code: `0` on success. Any failure (the GitHub relabel call or the safe-branch checkout) propagates as a plain thrown `Error` — no `STATUS=` line, no `DispatchFailure` shape, matching `checkout-safe-branch`'s existing hard-failure contract, not `spawn-issue`'s retry/`STATUS=failed` one.
- **Native module**: `core/lib/ArcanumSplitIssueFinish.js`, class `ArcanumSplitIssueFinish`, method `run(repoPath, issueId)`, registered in `core/bin/arcanum`'s `COMMANDS` map as `'arcanum-split-issue-finish': { module: 'ArcanumSplitIssueFinish.js', method: 'run' }`.
- **External calls from the native module**:
  - The not-yet-migrated GitHub relabel step shells out to `arcanum-split-issue/scripts/github.sh mark-split <repoPath> <issueId>` via `execFile` with an argument array (never a string-interpolated `exec()` — see the security requirements in `docs/agents/architecture/script-engine.md`).
  - The safe-branch release step reuses `SafeBranch#checkout` (from the already-migrated `core/lib/SafeBranch.js`) directly — no shelling out — and the native module formats the trailing `BRANCH=<branch>\n` line itself (mirroring `safe_branch_checkout`'s own `echo "BRANCH=${branch}"`).
- **Env allowlist**: the new `finish.sh` shim forwards `HOME` to the native invocation (same rationale as `spawn_issue.sh`: `gh`, invoked transitively through `github.sh mark-split`, needs `HOME` to find its own config once `engine_dispatch` strips the ambient environment).
