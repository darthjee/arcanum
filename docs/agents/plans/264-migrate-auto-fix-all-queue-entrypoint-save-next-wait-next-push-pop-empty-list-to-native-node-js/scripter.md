# scripter Plan: Migrate auto-fix-all-queue entrypoint (save, next, wait-next, push, pop, empty, list) to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- The 7 `engine_dispatch` command names, the 7 `queue_<subcommand>_shell.sh` filenames, the `HOME`-only-for-`save`/`push` env-var allowlist, and the `.claude/state/auto-fix-all-queue.{json,lock}` paths are exactly as specified in [plan.md](plan.md)'s "Shared contracts" — node's native module and tests depend on these matching character for character.
- Node's parity tests shell out directly to the `queue_<subcommand>_shell.sh` files this agent creates — they must preserve today's `queue.sh` behavior exactly (same stdout, same exit codes, same lock protocol) for every subcommand, since the parity tests assert shell vs. native equivalence against them.

## Implementation Steps

### Step 1 — Split `queue.sh` into per-subcommand shell scripts

Read today's `auto-fix-all/scripts/queue.sh` for its exact current behavior (all 7 subcommands, plus its `_read_queue`/`_mark_enqueued` helpers and its `arcanum/_lib/lock.sh`/`origin.sh`/`tags.sh`/`tag_mutate.sh` sourcing), then split it exactly the way `auto-fix-all/scripts/config.sh` was split for #261 (see `auto-fix-all/scripts/config_common.sh` + `config_get_shell.sh`/`config_is_enabled_shell.sh`/`config_set_shell.sh`/`config_toggle_shell.sh` as the precedent to mirror):

- `auto-fix-all/scripts/queue_common.sh` — shared constants/helpers factored out of today's `queue.sh`: `QUEUE_FILE`/`LOCK_FILE` paths, `_read_queue`, `_mark_enqueued` (and the `lock.sh`/`origin.sh`/`tags.sh`/`tag_mutate.sh` sourcing they need). Meant to be sourced, not executed.
- `auto-fix-all/scripts/queue_save_shell.sh` — today's `save` case branch, unchanged behavior. Usage: `queue_save_shell.sh <repo_path> <id...>`.
- `auto-fix-all/scripts/queue_next_shell.sh` — today's `next` case branch. Usage: `queue_next_shell.sh <repo_path>`.
- `auto-fix-all/scripts/queue_wait_next_shell.sh` — today's `wait-next` case branch (the 5s-poll infinite loop). Usage: `queue_wait_next_shell.sh <repo_path>`.
- `auto-fix-all/scripts/queue_push_shell.sh` — today's `push` case branch. Usage: `queue_push_shell.sh <repo_path> <id...>`.
- `auto-fix-all/scripts/queue_pop_shell.sh` — today's `pop` case branch. Usage: `queue_pop_shell.sh <repo_path>`.
- `auto-fix-all/scripts/queue_empty_shell.sh` — today's `empty` case branch. Usage: `queue_empty_shell.sh <repo_path>`.
- `auto-fix-all/scripts/queue_list_shell.sh` — today's `list` case branch. Usage: `queue_list_shell.sh <repo_path>`.

Each script's own usage/behavior must be byte-identical to today's corresponding `queue.sh <subcommand>` invocation — this is a pure extraction, no behavior change.

## Files to Change

- `auto-fix-all/scripts/queue_common.sh` — new, shared helpers extracted from `queue.sh`.
- `auto-fix-all/scripts/queue_save_shell.sh` — new, `save` subcommand logic.
- `auto-fix-all/scripts/queue_next_shell.sh` — new, `next` subcommand logic.
- `auto-fix-all/scripts/queue_wait_next_shell.sh` — new, `wait-next` subcommand logic.
- `auto-fix-all/scripts/queue_push_shell.sh` — new, `push` subcommand logic.
- `auto-fix-all/scripts/queue_pop_shell.sh` — new, `pop` subcommand logic.
- `auto-fix-all/scripts/queue_empty_shell.sh` — new, `empty` subcommand logic.
- `auto-fix-all/scripts/queue_list_shell.sh` — new, `list` subcommand logic.

### Step 2 — Replace `queue.sh` with a thin `engine_dispatch` shim, and flip migration-status

Replace the (now-split) `auto-fix-all/scripts/queue.sh` with a thin dispatcher, mirroring `auto-fix-all/scripts/config.sh`'s shape: parse the subcommand and `<repo_path>` (both still required leading args, same calling convention `queue.sh` already documents today — no change there), then route to `engine_dispatch`:

```bash
case "$SUBCOMMAND" in
  save)
    engine_dispatch "$REPO_PATH" auto-fix-all-queue-save "${SCRIPT_DIR}/queue_save_shell.sh" HOME -- "$REPO_PATH" "$@"
    ;;
  next)
    engine_dispatch "$REPO_PATH" auto-fix-all-queue-next "${SCRIPT_DIR}/queue_next_shell.sh" -- "$REPO_PATH"
    ;;
  wait-next)
    engine_dispatch "$REPO_PATH" auto-fix-all-queue-wait-next "${SCRIPT_DIR}/queue_wait_next_shell.sh" -- "$REPO_PATH"
    ;;
  push)
    engine_dispatch "$REPO_PATH" auto-fix-all-queue-push "${SCRIPT_DIR}/queue_push_shell.sh" HOME -- "$REPO_PATH" "$@"
    ;;
  pop)
    engine_dispatch "$REPO_PATH" auto-fix-all-queue-pop "${SCRIPT_DIR}/queue_pop_shell.sh" -- "$REPO_PATH"
    ;;
  empty)
    engine_dispatch "$REPO_PATH" auto-fix-all-queue-empty "${SCRIPT_DIR}/queue_empty_shell.sh" -- "$REPO_PATH"
    ;;
  list)
    engine_dispatch "$REPO_PATH" auto-fix-all-queue-list "${SCRIPT_DIR}/queue_list_shell.sh" -- "$REPO_PATH"
    ;;
esac
```

(Only `save`/`push` get `HOME` in the allowlist — see [plan.md](plan.md)'s "Shared contracts".) Preserve `queue.sh`'s existing usage/error message on an unrecognized or missing subcommand.

Then add the 7 new keys to `arcanum/_lib/migration-status.json`, each set to `true`: `auto-fix-all-queue-save`, `auto-fix-all-queue-next`, `auto-fix-all-queue-wait-next`, `auto-fix-all-queue-push`, `auto-fix-all-queue-pop`, `auto-fix-all-queue-empty`, `auto-fix-all-queue-list` — **not** a single umbrella `auto-fix-all-queue` key (see [plan.md](plan.md)'s "Shared contracts" for why: `engine_dispatch` looks up availability per exact command name). Coordinate with node on timing: flip these only once `core/bin/arcanum`'s `COMMANDS` map (node's Step 2) actually registers the matching entries, so `engine.mode=native` never points at a command the dispatcher can't yet route.

## Files to Change

- `auto-fix-all/scripts/queue.sh` — rewritten as a thin `engine_dispatch` shim (was the full implementation before Step 1).
- `arcanum/_lib/migration-status.json` — add the 7 `auto-fix-all-queue-*` keys.

## Notes

- No `SKILL.md` changes are expected: every existing caller of `queue.sh` (`auto-fix-all/SKILL.md`, `push-issue-to-queue/SKILL.md`) already passes `$REPO_PATH` as the leading argument to every subcommand — unlike `config.sh` in #261, `queue.sh`'s calling convention isn't changing, so no doc updates are needed for that reason.
- `docs/agents/architecture/entrypoint-migration-status.md` is auto-generated (`scripts/generate_entrypoint_migration_status.sh`, self-healing at release time per `scripts/bump-version.sh`) — do not hand-edit it.
