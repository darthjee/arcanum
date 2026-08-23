#!/usr/bin/env bash
# Thin per-subcommand engine_dispatch shim for the "auto-fix-all-queue-*"
# migrated entrypoints — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/264-migrate-auto-fix-all-queue-entrypoint-save-next-wait-next-push-pop-empty-list-to-native-node-js/plan.md
# for the full design/shared contracts. Queue management for auto-fix-all,
# via either the shell implementation (queue_<subcommand>_shell.sh) or the
# native one (core/bin/arcanum), per engine.mode / arcanum/_lib/migration-status.json.
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
# Only `save`/`push` forward HOME to a native invocation — their best-effort
# GitHub label mutation shells to `gh auth token`/`gh` label mutation, same
# reasoning as wait_ci.sh's/reply_comment.sh's HOME forwarding.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"

USAGE="Usage: $0 {save <repo_path> <id...>|next <repo_path>|wait-next <repo_path>|push <repo_path> <id...>|pop <repo_path>|empty <repo_path>|list <repo_path>}"

SUBCOMMAND="${1:-}"
[[ -n "$SUBCOMMAND" ]] || { echo "$USAGE" >&2; exit 1; }
shift

REPO_PATH="${1:-}"
[[ -n "$REPO_PATH" ]] || { echo "$USAGE" >&2; exit 1; }
shift

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
  *)
    echo "$USAGE" >&2
    exit 1
    ;;
esac
