#!/usr/bin/env bash
# Thin per-subcommand engine_dispatch shim for the "monitor-issues-config-*"
# migrated entrypoints — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/586-migrate-monitor-issues-entrypoints-to-native-node-js/plan.md
# for the full design/shared contracts. Config management for
# monitor-issues, via either the shell implementation
# (config_<subcommand>_shell.sh) or the native one (core/bin/arcanum), per
# engine.mode / arcanum/_lib/migration-status.json.
#
# Usage: config.sh get <key>
#        config.sh is-enabled <key>
#        config.sh set <key> true|false
#        config.sh toggle <key>
#
# The CLI stays cwd-relative (no <repo_path> argument): "$PWD" is passed
# as engine_dispatch's <repo_path> with --prepend-repo-path, so only the
# native invocation receives it as its leading positional; the
# config_<subcommand>_shell.sh scripts keep the plain <key> [<value>] CLI.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"

USAGE="Usage: $0 {get <key>|is-enabled <key>|set <key> true|false|toggle <key>}"

COMMAND="${1:-}"
case "$COMMAND" in
  get|is-enabled|set|toggle) ;;
  *)
    echo "$USAGE" >&2
    exit 1
    ;;
esac
shift

# From here, "$@" is <key> [<value>] — per-subcommand argument-count
# errors are raised by the shell/native implementations themselves.
SHELL_SCRIPT="${SCRIPT_DIR}/config_${COMMAND//-/_}_shell.sh"
engine_dispatch "$PWD" "monitor-issues-config-${COMMAND}" "$SHELL_SCRIPT" --prepend-repo-path -- "$@"
