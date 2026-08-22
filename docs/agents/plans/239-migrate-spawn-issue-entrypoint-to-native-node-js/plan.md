# Plan: Migrate spawn-issue entrypoint to native Node.js

Issue: [239-migrate-spawn-issue-entrypoint-to-native-node-js.md](../issues/239-migrate-spawn-issue-entrypoint-to-native-node-js.md)

## Overview

Migrate `arcanum/_lib/spawn_issue.sh` to a native Node.js implementation (`core/lib/SpawnIssue.js`, routed via `core/bin/arcanum spawn-issue`), the last sub-issue in the #232 migration batch. `spawn_issue.sh` has no `engine_dispatch` shim yet, so this plan also introduces one for the first time (splitting the current script into `spawn_issue_shell.sh` + a thin shim), following the same split `resolve_plan_paths.sh` went through in #235. The work is blocked on #237 (currently open as PR #248), which lands the `github-issue-create` routing key this migration's `create` step depends on — implementation must not start until that PR merges.

## Agents involved

- [node](node.md)
- [scripter](scripter.md)

## Shared contracts

- **Routing key**: `spawn-issue` — already present (`false`) in `arcanum/_lib/migration-status.json`. node's `core/bin/arcanum` `COMMANDS` entry and scripter's shim/`engine_dispatch` call must reference this exact key.
- **CLI shape, unchanged from today's shell script, passed through symmetrically on both `engine_dispatch` branches**: `<repo_path> <parent_id> <title> <body_file> [--as-subissue]`. No signature change (unlike #235's `resolve_plan_paths.sh`, `spawn_issue.sh` already takes `repo_path` as its first arg) — no caller updates needed anywhere (`discuss-issue/steps/discuss_and_save.md`, etc.).
- **stdout/exit-code contract**:
  - Success: `STATUS=ok\nID=<new_id>\nURL=<url>\n`, exit 0.
  - Failure (create's retry budget exhausted): `STATUS=failed\n`, exit **1** — a stdout-content-plus-nonzero-exit shape no prior migrated entrypoint has needed. node's plan introduces the mechanism for this (see [node.md](node.md), step 01); scripter's shim needs no special-casing for it — `engine_dispatch`/`exec` already propagate whatever exit code either branch produces, unmodified.
  - Only stdout + exit code are covered by the shell/native parity guarantee, per every prior migration's parity-test scope (stderr is never asserted, except where a test suite explicitly opts into it) — `SpawnIssue.js`'s retry-warning / label- and link-failure stderr text does not need to byte-match `spawn_issue.sh`'s.
- **`HOME` forwarding**: the shim's `engine_dispatch` call must forward `HOME` to the native branch (same reason `resolve_and_fetch.sh`'s shim does) — `gh auth token`/`gh issue view`/`gh issue edit`/`gh issue comment`/`gh api graphql` all need it.
- **Retry config**: both sides read `.claude/state/arcanum-config.json`'s `plan-issues.max-retry-count`/`error-sleep-time` (default 5/5) — node via a new `RepoConfig.js` reader (step 02), the existing shell fallback via `repo_config.sh` (unchanged).
