#!/usr/bin/env bash
# Thin per-subcommand engine_dispatch shim for the "auto-fix-all-config-*"
# migrated entrypoints — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/261-migrate-auto-fix-all-config-entrypoint-get-is-enabled-set-toggle-to-native-node-js/plan.md
# for the full design/shared contracts. Config management for
# auto-fix-all, via either the shell implementation
# (config_<subcommand>_shell.sh) or the native one (core/bin/arcanum), per
# engine.mode / arcanum/_lib/migration-status.json.
#
# Usage: config.sh get <repo_path> <key>
#        config.sh is-enabled <repo_path> <key>
#        config.sh set <repo_path> <key> true|false
#        config.sh toggle <repo_path> <key>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"

COMMAND="${1:-}"
[[ -n "$COMMAND" ]] || { echo "Usage: $0 {get <key>|is-enabled <key>|set <key> true|false|toggle <key>}" >&2; exit 1; }
shift

REPO_PATH="${1:-}"
[[ -n "$REPO_PATH" ]] || { echo "Usage: $0 $COMMAND <repo_path> [...]" >&2; exit 1; }
shift

# From here, "$@" is just <key> or <key> <value> — engine_dispatch's args
# below re-prepends "$REPO_PATH" so both the shell script and the native
# call receive an identical, correctly-shaped <repo_path> <key> [<value>].
case "$COMMAND" in
  get)
    engine_dispatch "$REPO_PATH" auto-fix-all-config-get "${SCRIPT_DIR}/config_get_shell.sh" -- "$REPO_PATH" "$@"
    ;;
  is-enabled)
    engine_dispatch "$REPO_PATH" auto-fix-all-config-is-enabled "${SCRIPT_DIR}/config_is_enabled_shell.sh" -- "$REPO_PATH" "$@"
    ;;
  set)
    engine_dispatch "$REPO_PATH" auto-fix-all-config-set "${SCRIPT_DIR}/config_set_shell.sh" -- "$REPO_PATH" "$@"
    ;;
  toggle)
    engine_dispatch "$REPO_PATH" auto-fix-all-config-toggle "${SCRIPT_DIR}/config_toggle_shell.sh" -- "$REPO_PATH" "$@"
    ;;
  *)
    echo "Usage: $0 {get <key>|is-enabled <key>|set <key> true|false|toggle <key>}" >&2
    exit 1
    ;;
esac
