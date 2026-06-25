#!/usr/bin/env bash

# Rewrite queue management for monitor-issues.
#
# State is stored in .claude/state/monitor-issues-rewrite-queue.json — a
# JSON array of entry objects ({"id": "<issue_id>"} each), mirroring
# auto-fix-all/scripts/queue.sh's schema so future fields can be added to
# an entry without changing the overall shape.
#
# Commands:
#   push <id>  — append the given issue id to the end of the queue if not
#                already present (idempotent), under lock. Exit 0 on
#                success.
#   pop        — remove and print the first entry's id (plain text, just
#                the id, one line) under lock. Prints nothing and exits 1
#                if the queue is empty.
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

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR=".claude/state"
QUEUE_FILE="${STATE_DIR}/monitor-issues-rewrite-queue.json"
LOCK_FILE="${STATE_DIR}/monitor-issues-rewrite-queue.lock"

mkdir -p "$STATE_DIR"

# shellcheck source=../../_lib/lock.sh
source "${SCRIPT_DIR}/../../_lib/lock.sh"

# Reads the queue array from QUEUE_FILE, or "[]" if absent/empty.
_read_queue() {
  if [[ -s "$QUEUE_FILE" ]]; then
    cat "$QUEUE_FILE"
  else
    echo "[]"
  fi
}

case ${1:-} in
  push)
    ID="${2:-}"
    if [[ -z "$ID" ]]; then
      echo "Error: push requires an ID" >&2
      exit 1
    fi
    _acquire_lock
    _read_queue | jq --arg id "$ID" 'if any(.[]; .id == $id) then . else . + [{"id": $id}] end' > "${QUEUE_FILE}.tmp"
    mv "${QUEUE_FILE}.tmp" "$QUEUE_FILE"
    _release_lock
    echo "Pushed: $ID"
    ;;

  pop)
    _acquire_lock
    ID=$(_read_queue | jq -r '.[0].id // ""')
    if [[ -z "$ID" ]]; then
      _release_lock
      exit 1
    fi
    _read_queue | jq '.[1:]' > "${QUEUE_FILE}.tmp"
    mv "${QUEUE_FILE}.tmp" "$QUEUE_FILE"
    _release_lock
    echo "$ID"
    ;;

  *)
    echo "Usage: $0 {push <id>|pop}" >&2
    exit 1
    ;;
esac
