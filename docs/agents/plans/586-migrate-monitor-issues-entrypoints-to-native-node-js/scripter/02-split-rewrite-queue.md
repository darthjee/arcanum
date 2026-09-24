# Split rewrite_queue.sh

Follow the same pattern as step 01, using the `auto-fix-all/scripts/queue.sh` precedent from #264.

- `rewrite_queue_common.sh` holds `QUEUE_FILE`, `LOCK_FILE`, `_read_queue` and the lock sourcing. `rewrite_queue_push_shell.sh` and `rewrite_queue_pop_shell.sh` contain today's bodies unchanged.
- `rewrite_queue.sh` becomes a shim that calls `engine_dispatch "$PWD" monitor-issues-rewrite-queue-<sub> "${SCRIPT_DIR}/rewrite_queue_<sub>_shell.sh" --prepend-repo-path -- "$@"`. The usage error is unchanged.
- Keep the header comment that documents the lock semantics, either in the shim or in the common file.

## Files to Change
- `monitor-issues/scripts/rewrite_queue.sh` — becomes the shim
- `monitor-issues/scripts/rewrite_queue_common.sh` — new
- `monitor-issues/scripts/rewrite_queue_{push,pop}_shell.sh` — new
