#!/usr/bin/env bash

# Queue management for auto-fix-all.
#
# State is stored in .claude/state/auto-fix-all-queue.json — a JSON array of
# entry objects (currently just {"id": "<id>"} each), so future fields (e.g.
# issue metadata or auto-fix-all options) can be added to an entry without
# changing the overall shape. The first element is always the current
# (in-progress) entry.
#
# Commands (every command takes <repo_path> as its own leading argument, for
# one consistent calling convention across all subcommands — commands that
# don't need it internally, e.g. next/wait-next/pop/empty/list, simply
# ignore it):
#   save <repo_path> <id...>  — overwrite the queue with the given IDs
#   next <repo_path>          — print the first ID without removing it (empty output = done)
#   wait-next <repo_path>     — like `next`, but if the queue is empty, sleep 5s and retry
#                               forever instead of returning empty
#   push <repo_path> <id...>  — append the given IDs to the end of the queue (locked)
#   pop <repo_path>           — remove the first ID (mark current issue as done) (locked)
#   empty <repo_path>         — exit 0 if queue is empty, exit 1 if it has items
#   list <repo_path>          — print all remaining IDs
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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR=".claude/state"
QUEUE_FILE="${STATE_DIR}/auto-fix-all-queue.json"
LOCK_FILE="${STATE_DIR}/auto-fix-all-queue.lock"

mkdir -p "$STATE_DIR"

# shellcheck source=../../arcanum/_lib/lock.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/lock.sh"
# shellcheck source=../../arcanum/_lib/origin.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/origin.sh"
# shellcheck source=../../arcanum/_lib/tags.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/tags.sh"
# shellcheck source=../../arcanum/_lib/tag_mutate.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/tag_mutate.sh"

# Reads the queue array from QUEUE_FILE, or "[]" if absent/empty.
_read_queue() {
  if [[ -s "$QUEUE_FILE" ]]; then
    cat "$QUEUE_FILE"
  else
    echo "[]"
  fi
}

# _mark_enqueued <repo_path> <id...>
#   Best-effort: adds the 'enqueued' tag and removes the 'ready_for_work'/
#   'created' tags (Ready for Work / Created) from each given issue id.
#   A failed mutation warns to stderr and does not block the caller — the
#   queue write itself has already happened by the time this runs.
_mark_enqueued() {
  local repo_path="$1"
  shift
  local repo_ref
  repo_ref=$(get_repo_ref "$repo_path")

  local id
  for id in "$@"; do
    tag_mutate_add_label "$id" "$repo_ref" enqueued \
      || echo "Warning: could not add 'enqueued' tag to issue #$id on $repo_ref" >&2
    tag_mutate_remove_label "$id" "$repo_ref" ready_for_work \
      || echo "Warning: could not remove 'ready_for_work' tag from issue #$id on $repo_ref" >&2
    tag_mutate_remove_label "$id" "$repo_ref" created \
      || echo "Warning: could not remove 'created' tag from issue #$id on $repo_ref" >&2
  done
}

case ${1:-} in
  save)
    shift
    REPO_PATH="${1:?Usage: $0 save <repo_path> <id...>}"
    shift
    if [[ $# -eq 0 ]]; then
      echo "Error: save requires at least one ID" >&2
      exit 1
    fi
    SAVE_IDS=("$@")
    printf '%s\n' "${SAVE_IDS[@]}" | jq -R '{id: .}' | jq -s '.' > "$QUEUE_FILE"
    echo "Queue saved: ${SAVE_IDS[*]}"
    _mark_enqueued "$REPO_PATH" "${SAVE_IDS[@]}"
    ;;

  next)
    shift
    REPO_PATH="${1:?Usage: $0 next <repo_path>}"
    _read_queue | jq -r '.[0].id // ""'
    ;;

  wait-next)
    shift
    REPO_PATH="${1:?Usage: $0 wait-next <repo_path>}"
    while [[ "$(_read_queue | jq 'length')" -eq 0 ]]; do
      sleep 5
    done
    _read_queue | jq -r '.[0].id'
    ;;

  push)
    shift
    REPO_PATH="${1:?Usage: $0 push <repo_path> <id...>}"
    shift
    if [[ $# -eq 0 ]]; then
      echo "Error: push requires at least one ID" >&2
      exit 1
    fi
    PUSH_IDS=("$@")
    _acquire_lock
    NEW_ENTRIES=$(printf '%s\n' "${PUSH_IDS[@]}" | jq -R '{id: .}' | jq -s '.')
    _read_queue | jq --argjson new "$NEW_ENTRIES" '. + $new' > "${QUEUE_FILE}.tmp"
    mv "${QUEUE_FILE}.tmp" "$QUEUE_FILE"
    _release_lock
    echo "Pushed: ${PUSH_IDS[*]}"
    _mark_enqueued "$REPO_PATH" "${PUSH_IDS[@]}"
    ;;

  pop)
    shift
    REPO_PATH="${1:?Usage: $0 pop <repo_path>}"
    _acquire_lock
    _read_queue | jq '.[1:]' > "${QUEUE_FILE}.tmp"
    mv "${QUEUE_FILE}.tmp" "$QUEUE_FILE"
    _release_lock
    ;;

  empty)
    shift
    REPO_PATH="${1:?Usage: $0 empty <repo_path>}"
    if [[ "$(_read_queue | jq 'length')" -eq 0 ]]; then
      exit 0
    fi
    exit 1
    ;;

  list)
    shift
    REPO_PATH="${1:?Usage: $0 list <repo_path>}"
    IDS=$(_read_queue | jq -r '.[].id')
    if [[ -n "$IDS" ]]; then
      echo "$IDS"
    else
      echo "(empty)"
    fi
    ;;

  *)
    echo "Usage: $0 {save <repo_path> <id...>|next <repo_path>|wait-next <repo_path>|push <repo_path> <id...>|pop <repo_path>|empty <repo_path>|list <repo_path>}" >&2
    exit 1
    ;;
esac
