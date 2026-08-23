#!/usr/bin/env bash
# Shared constants/helpers for auto-fix-all's queue_<subcommand>_shell.sh
# scripts (queue_save_shell.sh, queue_next_shell.sh, queue_wait_next_shell.sh,
# queue_push_shell.sh, queue_pop_shell.sh, queue_empty_shell.sh,
# queue_list_shell.sh) — factored out of the old single queue.sh so none of
# the 7 scripts duplicate them.
#
# This file is meant to be SOURCED, not executed directly.

QUEUE_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR=".claude/state"
QUEUE_FILE="${STATE_DIR}/auto-fix-all-queue.json"
LOCK_FILE="${STATE_DIR}/auto-fix-all-queue.lock"

mkdir -p "$STATE_DIR"

# shellcheck source=../../arcanum/_lib/lock.sh
source "${QUEUE_COMMON_DIR}/../../arcanum/_lib/lock.sh"
# shellcheck source=../../arcanum/_lib/origin.sh
source "${QUEUE_COMMON_DIR}/../../arcanum/_lib/origin.sh"
# shellcheck source=../../arcanum/_lib/tags.sh
source "${QUEUE_COMMON_DIR}/../../arcanum/_lib/tags.sh"
# shellcheck source=../../arcanum/_lib/tag_mutate.sh
source "${QUEUE_COMMON_DIR}/../../arcanum/_lib/tag_mutate.sh"

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
