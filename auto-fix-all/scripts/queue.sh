#!/usr/bin/env bash

# Queue management for auto-fix-all.
#
# State is stored in .claude/state/auto-fix-all-queue.txt — one ID per line.
# The first line is always the current (in-progress) ID.
#
# Commands:
#   save <id...>  — overwrite the queue with the given IDs
#   next          — print the first ID without removing it (empty output = done)
#   wait-next     — like `next`, but if the queue is empty, sleep 5s and retry
#                   forever instead of returning empty
#   push <id...>  — append the given IDs to the end of the queue (locked)
#   pop           — remove the first ID (mark current issue as done) (locked)
#   empty         — exit 0 if queue is empty, exit 1 if it has items
#   list          — print all remaining IDs
#
# `push` and `pop` both mutate the shared queue file, so they go through a
# simple lock (.claude/state/auto-fix-all-queue.lock) to avoid one
# clobbering the other if they ever run concurrently: write this
# invocation's instance id into the lock file, sleep 1s, re-read it back —
# if it still matches, the lock is held; otherwise retry. Acquisition never
# gives up: every 10 attempts the attempt counter resets to 0 (so it never
# grows unbounded), and the very first time that threshold is hit a warning
# is printed — once only, never again for the same acquisition — that the
# lock looks stuck and may need manual intervention (check whether a process
# actually holds it, and if not, remove the lock file by hand). It then
# keeps retrying silently. The lock file is removed once the mutation is
# done.

set -euo pipefail

STATE_DIR=".claude/state"
QUEUE_FILE="${STATE_DIR}/auto-fix-all-queue.txt"
LOCK_FILE="${STATE_DIR}/auto-fix-all-queue.lock"

mkdir -p "$STATE_DIR"

_acquire_lock() {
  local instance_id="${HOSTNAME:-host}-$$-$(date +%s%N)"
  local attempt=0
  local warned=false
  while true; do
    attempt=$((attempt + 1))
    echo "$instance_id" > "$LOCK_FILE"
    sleep 1
    if [[ "$(cat "$LOCK_FILE" 2>/dev/null)" == "$instance_id" ]]; then
      return 0
    fi
    if (( attempt % 10 == 0 )); then
      if [[ "$warned" == false ]]; then
        echo "Warning: queue lock ($LOCK_FILE) seems stuck after ${attempt} attempts — check whether a process is actually holding it, and if not, remove the lock file manually. Retrying..." >&2
        warned=true
      fi
      attempt=0
    fi
  done
}

_release_lock() {
  rm -f "$LOCK_FILE"
}

case ${1:-} in
  save)
    shift
    if [[ $# -eq 0 ]]; then
      echo "Error: save requires at least one ID" >&2
      exit 1
    fi
    printf '%s\n' "$@" > "$QUEUE_FILE"
    echo "Queue saved: $*"
    ;;

  next)
    if [[ ! -f "$QUEUE_FILE" ]] || [[ ! -s "$QUEUE_FILE" ]]; then
      echo ""
      exit 0
    fi
    head -1 "$QUEUE_FILE"
    ;;

  wait-next)
    while [[ ! -f "$QUEUE_FILE" ]] || [[ ! -s "$QUEUE_FILE" ]]; do
      sleep 5
    done
    head -1 "$QUEUE_FILE"
    ;;

  push)
    shift
    if [[ $# -eq 0 ]]; then
      echo "Error: push requires at least one ID" >&2
      exit 1
    fi
    _acquire_lock
    printf '%s\n' "$@" >> "$QUEUE_FILE"
    _release_lock
    echo "Pushed: $*"
    ;;

  pop)
    if [[ ! -f "$QUEUE_FILE" ]]; then
      exit 0
    fi
    _acquire_lock
    tail -n +2 "$QUEUE_FILE" > "${QUEUE_FILE}.tmp"
    mv "${QUEUE_FILE}.tmp" "$QUEUE_FILE"
    _release_lock
    ;;

  empty)
    if [[ ! -f "$QUEUE_FILE" ]] || [[ ! -s "$QUEUE_FILE" ]]; then
      exit 0
    fi
    exit 1
    ;;

  list)
    if [[ -f "$QUEUE_FILE" ]] && [[ -s "$QUEUE_FILE" ]]; then
      cat "$QUEUE_FILE"
    else
      echo "(empty)"
    fi
    ;;

  *)
    echo "Usage: $0 {save <id...>|next|wait-next|push <id...>|pop|empty|list}" >&2
    exit 1
    ;;
esac
