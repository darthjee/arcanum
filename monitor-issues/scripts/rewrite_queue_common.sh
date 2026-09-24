#!/usr/bin/env bash
# Shared constants/helpers for monitor-issues' rewrite_queue_<subcommand>_shell.sh
# scripts (rewrite_queue_push_shell.sh, rewrite_queue_pop_shell.sh) —
# factored out of the old single rewrite_queue.sh.
#
# State is stored in .claude/state/monitor-issues-rewrite-queue.json — a
# JSON array of entry objects ({"id": "<issue_id>"} each), mirroring
# auto-fix-all/scripts/queue.sh's schema so future fields can be added to
# an entry without changing the overall shape. Paths are relative to the
# caller's cwd (the target project's root).
#
# `push` and `pop` both mutate the shared queue file, so they go through a
# simple lock (.claude/state/monitor-issues-rewrite-queue.lock) to avoid
# one clobbering the other if they ever run concurrently: write this
# invocation's instance id into the lock file, sleep 1s, re-read it back —
# if it still matches, the lock is held; otherwise retry. Acquisition never
# gives up: every 10 attempts the attempt counter resets to 0 (so it never
# grows unbounded), and the very first time that threshold is hit a warning
# is printed — once only, never again for the same acquisition — that the
# lock looks stuck and may need manual intervention (check whether a
# process actually holds it, and if not, remove the lock file by hand). It
# then keeps retrying silently. The lock file is removed once the mutation
# is done.
#
# This file is meant to be SOURCED, not executed directly.

REWRITE_QUEUE_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR=".claude/state"
QUEUE_FILE="${STATE_DIR}/monitor-issues-rewrite-queue.json"
# shellcheck disable=SC2034
# Read by _acquire_lock/_release_lock (lock.sh, sourced below), called by
# rewrite_queue_push_shell.sh / rewrite_queue_pop_shell.sh
LOCK_FILE="${STATE_DIR}/monitor-issues-rewrite-queue.lock"

mkdir -p "$STATE_DIR"

# shellcheck source=../../arcanum/_lib/lock.sh
source "${REWRITE_QUEUE_COMMON_DIR}/../../arcanum/_lib/lock.sh"

# Reads the queue array from QUEUE_FILE, or "[]" if absent/empty.
_read_queue() {
  if [[ -s "$QUEUE_FILE" ]]; then
    cat "$QUEUE_FILE"
  else
    echo "[]"
  fi
}
