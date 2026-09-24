#!/usr/bin/env bash
# Thin per-subcommand engine_dispatch shim for the
# "monitor-issues-github-*" migrated entrypoints — see
# docs/agents/architecture/script-engine.md and
# docs/agents/plans/586-migrate-monitor-issues-entrypoints-to-native-node-js/plan.md
# for the full design/shared contracts. GitHub operations for
# monitor-issues, via either the shell implementation
# (github_<subcommand>_shell.sh) or the native one (core/bin/arcanum), per
# engine.mode / arcanum/_lib/migration-status.json.
#
# `HOME` is forwarded to the native path's env-var allowlist (gh auth /
# config resolution).
#
# Usage: github.sh <command> <repo_path> [args]
#   remove-tag <repo_path> <id> <tag>   Remove a single tag from GitHub issue <id>,
#                                       mapped to a real GitHub label via the
#                                       canonical-tag/label-name table in `arcanum/_lib/tags.sh`.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"

case "${1:-}" in
  remove-tag)
    shift
    # Validated here (same message as before the migration) so
    # engine_dispatch never runs with an empty <repo_path>.
    [[ -n "${1:-}" && -n "${2:-}" && -n "${3:-}" ]] || {
      echo "Usage: $0 remove-tag <repo_path> <id> <tag>" >&2
      exit 1
    }
    engine_dispatch "$1" monitor-issues-github-remove-tag "${SCRIPT_DIR}/github_remove_tag_shell.sh" HOME -- "$@"
    ;;
  *)
    echo "Usage: $0 <command> <repo_path> [args]" >&2
    echo "Commands:" >&2
    echo "  remove-tag <repo_path> <id> <tag>   Remove a single tag from GitHub issue <id>, mapped to a real GitHub label via arcanum/_lib/tags.sh" >&2
    exit 1
    ;;
esac
