# Plan: Migrate auto-fix-all-queue entrypoint (save, next, wait-next, push, pop, empty, list) to native Node.js

Issue: [264-migrate-auto-fix-all-queue-entrypoint-save-next-wait-next-push-pop-empty-list-to-native-node-js.md](../issues/264-migrate-auto-fix-all-queue-entrypoint-save-next-wait-next-push-pop-empty-list-to-native-node-js.md)

## Overview

`auto-fix-all/scripts/queue.sh` (7 subcommands: `save`, `next`, `wait-next`, `push`, `pop`, `empty`, `list`) migrates to native Node.js following `docs/agents/architecture/script-engine.md`, using the same shell-split precedent already established for the other multi-subcommand entrypoint in this family (`auto-fix-all-config-*`, #261): the current single `queue.sh` splits into one shell script per subcommand plus a thin `engine_dispatch` shim (scripter), while a new `core/lib/AutoFixAllQueue.js` module provides the native counterpart with one method per subcommand, wired into `core/bin/arcanum` and covered by unit + parity tests (node).

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

- **Command names**: the 7 `engine_dispatch` command names scripter's shim dispatches on are exactly `auto-fix-all-queue-save`, `auto-fix-all-queue-next`, `auto-fix-all-queue-wait-next`, `auto-fix-all-queue-push`, `auto-fix-all-queue-pop`, `auto-fix-all-queue-empty`, `auto-fix-all-queue-list`. These same 7 strings are node's `core/bin/arcanum` `COMMANDS` map keys and `arcanum/_lib/migration-status.json` keys — must match exactly, character for character, or `engine_dispatch`/`core/bin/arcanum` routing breaks silently (falls back to shell, or 404s).
- **Shell script filenames**: scripter creates `auto-fix-all/scripts/queue_save_shell.sh`, `queue_next_shell.sh`, `queue_wait_next_shell.sh`, `queue_push_shell.sh`, `queue_pop_shell.sh`, `queue_empty_shell.sh`, `queue_list_shell.sh` (plus shared `queue_common.sh`). Node's parity tests (`core/spec/bin/autoFixAllQueueParity_spec.js`) shell out to these exact filenames to compare against the native module — must exist with these exact names before the parity tests can run.
- **Output/exit-code contract**: node's `AutoFixAllQueue.js` methods must be byte-identical in stdout and exit code to scripter's corresponding `queue_<subcommand>_shell.sh`, for every subcommand — see today's `queue.sh` (soon to be split) for the exact current contract, reproduced verbatim in each `queue_<subcommand>_shell.sh`.
- **State file paths**: `.claude/state/auto-fix-all-queue.json` (queue array) and `.claude/state/auto-fix-all-queue.lock` (lock file) — both scripter's shell scripts and node's `AutoFixAllQueue.js` (via `core/lib/Lock.js`) read/write these same two paths, relative to `repoPath`.
- **Env-var allowlist**: scripter's `queue.sh` shim forwards `HOME` to the native path only for the `save` and `push` subcommands (their best-effort GitHub label mutation needs `gh auth token` credentials); `next`/`wait-next`/`pop`/`empty`/`list` forward no extra env vars. Node's `save`/`push` methods must resolve GitHub auth correctly given only `PATH`/`HOME`/`ARCANUM_REPO_PATH` in their environment (no broader ambient env) — same constraint `AutoFixAllWaitCi.js`/`AutoFixAllReplyComment.js` already satisfy.
- **Already-existing reusable native helpers** (do not reinvent): `core/lib/Lock.js` (`acquire(lockFile)`/`release(lockFile)`, already used by `AutoFixAllConfig.js`) for the `push`/`pop` lock guard, and `core/lib/Tags.js`'s `LABEL_TO_TAG` table for resolving `enqueued`/`ready_for_work`/`created` tag names to their GitHub label names (`Enqueued`/`Ready for Work`/`Created`) in the best-effort label mutation.
