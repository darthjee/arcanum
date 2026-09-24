#!/usr/bin/env bash
# Thin per-subcommand engine_dispatch shim for the
# "monitor-issues-rewrite-queue-*" migrated entrypoints — see
# docs/agents/architecture/script-engine.md and
# docs/agents/plans/586-migrate-monitor-issues-entrypoints-to-native-node-js/plan.md
# for the full design/shared contracts. Rewrite queue management for
# monitor-issues, via either the shell implementation
# (rewrite_queue_<subcommand>_shell.sh) or the native one
# (core/bin/arcanum), per engine.mode / arcanum/_lib/migration-status.json.
#
# Commands:
#   push <id>  — append the given issue id to the end of the queue if not
#                already present (idempotent), under lock. Exit 0 on
#                success.
#   pop        — remove and print the first entry's id (plain text, just
#                the id, one line) under lock. Prints nothing and exits 1
#                if the queue is empty.
#
# Queue schema and lock semantics are documented in
# rewrite_queue_common.sh.
#
# The CLI stays cwd-relative (no <repo_path> argument): "$PWD" is passed
# as engine_dispatch's <repo_path> with --prepend-repo-path, so only the
# native invocation receives it as its leading positional.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"

COMMAND="${1:-}"
case "$COMMAND" in
  push|pop) ;;
  *)
    echo "Usage: $0 {push <id>|pop}" >&2
    exit 1
    ;;
esac
shift

engine_dispatch "$PWD" "monitor-issues-rewrite-queue-${COMMAND}" \
  "${SCRIPT_DIR}/rewrite_queue_${COMMAND}_shell.sh" --prepend-repo-path -- "$@"
