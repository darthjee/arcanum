# Issue: Migrate auto-fix-all-queue entrypoint (save, next, wait-next, push, pop, empty, list) to native Node.js

## Description

Sub-issue of #252 (batch overview). Part of the `auto-fix-all` family.

## Source script

`auto-fix-all/scripts/queue.sh`

Queue management for auto-fix-all, with 7 subcommands: `save <id...>`, `next`, `wait-next`, `push <id...>`, `pop`, `empty`, `list`. State is a JSON array in `.claude/state/auto-fix-all-queue.json`; `push`/`pop` are lock-guarded (`.claude/state/auto-fix-all-queue.lock`) against concurrent mutation. `save`/`push` also best-effort tag-mutate the affected GitHub issues (`enqueued` added, `ready_for_work`/`created` removed).

## Migration

Follow `docs/agents/architecture/script-engine.md` and, since this is a 7-subcommand entrypoint, the exact shell/native split precedent already established by the `auto-fix-all-config-*` migration (#261 — `auto-fix-all/scripts/config.sh` + `config_<subcommand>_shell.sh` + `config_common.sh`), not the single-command `_shell.sh`/thin-shim split used by e.g. `wait_ci.sh`/`checkout_from_main.sh`:

1. Read `auto-fix-all/scripts/queue.sh` for its exact output/exit-code contract (all 7 subcommands), including its shared helpers (`_read_queue`, `_mark_enqueued`) and its `arcanum/_lib/lock.sh`/`origin.sh`/`tags.sh`/`tag_mutate.sh` sourcing.
2. Split the current single `queue.sh` into per-subcommand shell scripts, mirroring `config.sh`'s split:
   - `auto-fix-all/scripts/queue_common.sh` — shared constants/helpers factored out of today's `queue.sh` (`QUEUE_FILE`, `LOCK_FILE`, `_read_queue`, `_mark_enqueued`), sourced by each of the 7 scripts below (mirrors `config_common.sh`).
   - `auto-fix-all/scripts/queue_save_shell.sh`, `queue_next_shell.sh`, `queue_wait_next_shell.sh`, `queue_push_shell.sh`, `queue_pop_shell.sh`, `queue_empty_shell.sh`, `queue_list_shell.sh` — one file per subcommand, each the exact existing `case` branch body from today's `queue.sh`, unchanged in behavior (mirrors `config_get_shell.sh` etc.).
   - Replace `auto-fix-all/scripts/queue.sh` itself with a new thin `engine_dispatch` shim (mirrors `config.sh`): parses the subcommand, then routes each to `engine_dispatch "$REPO_PATH" auto-fix-all-queue-<subcommand> "${SCRIPT_DIR}/queue_<subcommand>_shell.sh" [env-var-allowlist] -- "$REPO_PATH" "$@"`. Only `save` and `push` need `HOME` in the env-var allowlist (their `_mark_enqueued` call shells to `gh auth token`/`gh` label mutation, same reasoning as `reply_comment.sh`'s/`wait_ci.sh`'s `HOME` forwarding) — `next`/`wait-next`/`pop`/`empty`/`list` are purely local file I/O and need no extra allowlist entries.
3. Create `core/lib/AutoFixAllQueue.js` (zero runtime deps, built-in Node APIs only) with methods `save`, `next`, `waitNext`, `push`, `pop`, `empty`, `list`. For locking, use `core/lib/Lock.js` directly (`acquire(lockFile)`/`release(lockFile)`) around `push`/`pop` — it already implements `lock.sh`'s exact protocol (instance-id write, sleep, re-read, self-resetting attempt counter, one-time "looks stuck" warning); do not re-derive it. For the `waitNext` poll interval, follow the same constructor-injected sleep precedent already used by `Lock.js` (`sleepMs` option) and `AutoFixAllWaitCi.js` (`sleepFn`/`pollIntervalMs` options).
4. Register in `core/bin/arcanum`'s `COMMANDS` map, one entry per subcommand (matching the `queue_<subcommand>_shell.sh` names and the `engine_dispatch` command names from step 2):
   - `'auto-fix-all-queue-save': { module: 'AutoFixAllQueue.js', method: 'save' }`
   - `'auto-fix-all-queue-next': { module: 'AutoFixAllQueue.js', method: 'next' }`
   - `'auto-fix-all-queue-wait-next': { module: 'AutoFixAllQueue.js', method: 'waitNext' }`
   - `'auto-fix-all-queue-push': { module: 'AutoFixAllQueue.js', method: 'push' }`
   - `'auto-fix-all-queue-pop': { module: 'AutoFixAllQueue.js', method: 'pop' }`
   - `'auto-fix-all-queue-empty': { module: 'AutoFixAllQueue.js', method: 'empty' }`
   - `'auto-fix-all-queue-list': { module: 'AutoFixAllQueue.js', method: 'list' }`
5. Add **7 separate** keys to `arcanum/_lib/migration-status.json` — one per subcommand (`"auto-fix-all-queue-save": true`, `"auto-fix-all-queue-next": true`, `"auto-fix-all-queue-wait-next": true`, `"auto-fix-all-queue-push": true`, `"auto-fix-all-queue-pop": true`, `"auto-fix-all-queue-empty": true`, `"auto-fix-all-queue-list": true`) — **not** a single umbrella `"auto-fix-all-queue": true` key, since `engine_dispatch`/`_engine_dispatch_native_available` looks up availability per exact command name, and each subcommand is dispatched under its own command name per step 2/4. This matches the `auto-fix-all-config-*` precedent (4 separate keys, not one `auto-fix-all-config`), not the single-command `auto-fix-all-wait-ci`/`auto-fix-all-checkout-from-main` precedent (1 key because there's only 1 command).
6. Write native unit tests in `core/spec/AutoFixAllQueue_spec.js`, covering all 7 subcommands including lock contention.
7. Write parity tests (shell vs. native, identical stdout/exit code) for each subcommand, against the new `queue_<subcommand>_shell.sh` files from step 2.
8. Verify `arcanum/_lib/engine_dispatch.sh` routes correctly for `engine.mode=native` and `engine.mode=shell` for each of the 7 subcommands — no changes to `engine_dispatch.sh` itself are expected (it's already generic), this is verification only.

## External dependencies

- `.claude/state/auto-fix-all-queue.json` (JSON array read/write) and `.claude/state/auto-fix-all-queue.lock` — **`core/lib/Lock.js` already exists** and implements `arcanum/_lib/lock.sh`'s exact protocol; reuse it directly (see step 3 above) rather than re-deriving the lock protocol.
- GitHub label mutation (`enqueued` add, `ready_for_work`/`created` remove) via `arcanum/_lib/tags.sh` + `tag_mutate.sh` — no native counterpart yet for the write side. `core/lib/Tags.js` already exists but only covers the read-side label→tag mapping (`Tags.extractTags`/`LABEL_TO_TAG`); reuse its `LABEL_TO_TAG` table to resolve tag names to GitHub label names (`enqueued` → `Enqueued`, `ready_for_work` → `Ready for Work`, `created` → `Created`) rather than hardcoding a second copy, but the add/remove-label GitHub API calls themselves still need to be written natively here. Best-effort: failures warn to stderr but never block the queue mutation itself — preserve that best-effort/non-blocking behavior natively.

## Dependencies on other sub-issues

None — no in-batch script calls this one or is called by it.
