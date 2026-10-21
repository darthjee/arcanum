#!/usr/bin/env bash
# Shared constants/helpers for monitor-issues' config_<subcommand>_shell.sh
# scripts (config_get_shell.sh, config_is_enabled_shell.sh,
# config_set_shell.sh, config_toggle_shell.sh) — factored out of the old
# single config.sh so none of the 4 scripts duplicate them.
#
# Config lives under the "monitor-issues" namespace of the shared,
# namespaced arcanum config files (via arcanum/_lib/repo_config.sh):
#   - clear_context: personal, frequently-toggled state, in the gitignored
#     .claude/state/arcanum-config.json, with no legacy fallback.
#   - every other key: in the committed
#     .claude/configuration/arcanum-repo-config.json, falling back to (and
#     seeded from) the legacy .claude/configuration/monitor-issues.json.
# See docs/guides/arcanum-repo-config.md.
#
# All paths are relative to the caller's cwd (the target project's root).
#
# This file is meant to be SOURCED, not executed directly.

CONFIG_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE=".claude/configuration/monitor-issues.json"
NEW_CONFIG_FILE=".claude/configuration/arcanum-repo-config.json"
NEW_STATE_FILE=".claude/state/arcanum-config.json"
# shellcheck disable=SC2034 # consumed by config_{toggle,is_enabled,get,set}_shell.sh
NAMESPACE="monitor-issues"

# shellcheck source=../../arcanum/_lib/repo_config.sh
source "${CONFIG_COMMON_DIR}/../../arcanum/_lib/repo_config.sh"

# Returns the NEW (namespaced) file that a given key should be read
# from/written to: clear_context lives in the gitignored state file;
# every other key lives in the committed configuration file.
_new_file_for_key() {
  case "$1" in
    clear_context) echo "$NEW_STATE_FILE" ;;
    *) echo "$NEW_CONFIG_FILE" ;;
  esac
}

# Returns the LEGACY file counterpart of _new_file_for_key, used as a
# fallback by repo_config_read/repo_config_write. clear_context has no
# legacy fallback (returns "", which repo_config_read's
# [[ -f "$legacy_file" ]] check treats as "no legacy file") — its old
# .claude/state/monitor-issues-config.json value is carried forward once
# by the arcanum/migrations/repos/next/001.sh local migration instead.
_legacy_file_for_key() {
  case "$1" in
    clear_context) echo "" ;;
    *) echo "$CONFIG_FILE" ;;
  esac
}
