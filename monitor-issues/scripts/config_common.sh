#!/usr/bin/env bash
# Shared constants/helpers for monitor-issues' config_<subcommand>_shell.sh
# scripts (config_get_shell.sh, config_is_enabled_shell.sh,
# config_set_shell.sh, config_toggle_shell.sh) — factored out of the old
# single config.sh so none of the 4 scripts duplicate them.
#
# Config lives under the "monitor-issues" namespace of the shared,
# namespaced arcanum config files (via arcanum/_lib/repo_config.sh):
#   - clear_context: personal, frequently-toggled state, in the gitignored
#     .claude/state/arcanum-config.json. Its old
#     .claude/state/monitor-issues-config.json value was carried forward
#     once by the arcanum/migrations/repos/next/001.sh local migration.
#   - every other key: in the committed
#     .claude/configuration/arcanum-repo-config.json.
# The legacy .claude/configuration/monitor-issues.json is never read nor
# used to seed the namespace.
# See docs/guides/arcanum-repo-config.md.
#
# All paths are relative to the caller's cwd (the target project's root).
#
# This file is meant to be SOURCED, not executed directly.

CONFIG_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NEW_CONFIG_FILE=".claude/configuration/arcanum-repo-config.json"
NEW_STATE_FILE=".claude/state/arcanum-config.json"
# shellcheck disable=SC2034 # consumed by config_{toggle,is_enabled,get,set}_shell.sh
NAMESPACE="monitor-issues"

# shellcheck source=../../arcanum/_lib/repo_config.sh
source "${CONFIG_COMMON_DIR}/../../arcanum/_lib/repo_config.sh"
# shellcheck source=../../arcanum/_lib/config_chain.sh
source "${CONFIG_COMMON_DIR}/../../arcanum/_lib/config_chain.sh"

# Returns the NEW (namespaced) file that a given key is written to (by
# config_set_shell.sh/config_toggle_shell.sh). _config_read_value only
# reads it for a key not in keys.json; a registered key resolves its
# tiers from the registry through config_chain_read instead.
# clear_context lives in the gitignored state file; every other key
# lives in the committed configuration file.
_new_file_for_key() {
  case "$1" in
    clear_context) echo "$NEW_STATE_FILE" ;;
    *) echo "$NEW_CONFIG_FILE" ;;
  esac
}

# _config_read_value <key>
#   Prints the raw (jq -c) value of <key> under NAMESPACE, or nothing,
#   mirroring NamespacedBooleanKeyConfig#_readValue/#_readNewValue
#   (core/lib/utils/config/NamespacedBooleanKeyConfig.js):
#     1. a key registered in shared/lib/config/keys.json is read through
#        config_chain_read, i.e. from the tiers the registry allows for
#        it (a `null` value resolves to empty here);
#     2. an unregistered key gets a direct, presence-checked read of
#        _new_file_for_key (so an explicit `null` prints `null`).
#   No legacy file is ever read.
#   Always exits 0; callers apply their own default.
_config_read_value() {
  local key="$1" value

  if key_registry_has_key "${NAMESPACE}.${key}"; then
    # config-key: monitor-issues.clear_context
    value=$(config_chain_read "." "$NAMESPACE" "$key")
  else
    # config-key: monitor-issues.clear_context
    value=$(repo_config_read "$(_new_file_for_key "$key")" "" "$NAMESPACE" "$key")
  fi

  [[ -n "$value" ]] && echo "$value"
  return 0
}
