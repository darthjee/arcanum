#!/usr/bin/env bash
# Shared constants/helpers for auto-fix-all's config_<subcommand>_shell.sh
# scripts (config_get_shell.sh, config_is_enabled_shell.sh,
# config_set_shell.sh, config_toggle_shell.sh) — factored out of the old
# single config.sh so none of the 4 scripts duplicate them.
#
# This file is meant to be SOURCED, not executed directly.

CONFIG_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE=".claude/configuration/auto-fix-all.json"
NEW_CONFIG_FILE=".claude/configuration/arcanum-repo-config.json"
NEW_STATE_FILE=".claude/state/arcanum-config.json"
NAMESPACE="auto-fix-all"

# shellcheck source=../../arcanum/_lib/repo_config.sh
source "${CONFIG_COMMON_DIR}/../../arcanum/_lib/repo_config.sh"

# Returns the NEW (namespaced) file that a given key should be read
# from/written to: clear_context and finish_on_empty_queue are personal,
# frequently-toggled state and live in the gitignored state file; every
# other key lives in the committed configuration file.
_new_file_for_key() {
  case "$1" in
    clear_context|finish_on_empty_queue) echo "$NEW_STATE_FILE" ;;
    *) echo "$NEW_CONFIG_FILE" ;;
  esac
}

# Returns the LEGACY file counterpart of _new_file_for_key, used as a
# fallback by repo_config_read/repo_config_write. clear_context and
# finish_on_empty_queue have no read-time legacy fallback (returns "",
# which repo_config_read's [[ -f "$legacy_file" ]] check treats as "no
# legacy file") — see docs/guides/arcanum-repo-config.md. Every other
# key still falls back to its legacy file as before.
_legacy_file_for_key() {
  case "$1" in
    clear_context|finish_on_empty_queue) echo "" ;;
    *) echo "$CONFIG_FILE" ;;
  esac
}
