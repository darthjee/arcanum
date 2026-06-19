#!/usr/bin/env bash

# Queue management for auto-fix-all.
#
# State is stored in .claude/state/auto-fix-all-queue.txt — one ID per line.
# The first line is always the current (in-progress) ID.
#
# Commands:
#   save <id...>  — overwrite the queue with the given IDs
#   next          — print the first ID without removing it (empty output = done)
#   pop           — remove the first ID (mark current issue as done)
#   empty         — exit 0 if queue is empty, exit 1 if it has items
#   list          — print all remaining IDs

set -euo pipefail

STATE_DIR=".claude/state"
QUEUE_FILE="${STATE_DIR}/auto-fix-all-queue.txt"

mkdir -p "$STATE_DIR"

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

  pop)
    if [[ ! -f "$QUEUE_FILE" ]]; then
      exit 0
    fi
    tail -n +2 "$QUEUE_FILE" > "${QUEUE_FILE}.tmp"
    mv "${QUEUE_FILE}.tmp" "$QUEUE_FILE"
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
    echo "Usage: $0 {save <id...>|next|pop|empty|list}" >&2
    exit 1
    ;;
esac
