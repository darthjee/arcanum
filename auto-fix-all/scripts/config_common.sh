#!/usr/bin/env bash
# Shared constants/helpers for auto-fix-all's config_<subcommand>_shell.sh
# scripts (config_get_shell.sh, config_is_enabled_shell.sh,
# config_set_shell.sh, config_toggle_shell.sh) — factored out of the old
# single config.sh so none of the 4 scripts duplicate them.
#
# This file is meant to be SOURCED, not executed directly.

CONFIG_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC2034 # consumed by config_{toggle,is_enabled,get,set}_shell.sh
NAMESPACE="auto-fix-all"

# shellcheck source=../../arcanum/_lib/repo_config.sh
source "${CONFIG_COMMON_DIR}/../../arcanum/_lib/repo_config.sh"
# shellcheck source=../../arcanum/_lib/config_chain.sh
source "${CONFIG_COMMON_DIR}/../../arcanum/_lib/config_chain.sh"

# _write_tier_for_key <key>
#   Prints the tier (local, repo or global) that config_set_shell.sh/
#   config_toggle_shell.sh write <key> to: the default tier of the
#   NAMESPACE.<key> entry in shared/lib/config/keys.json (see
#   key_registry_default_tier), or `repo` for a key the registry doesn't
#   know. Mirrors NamespacedBooleanKeyConfig#_newFileForKey.
_write_tier_for_key() {
  local tier
  tier="$(key_registry_default_tier "${NAMESPACE}.$1")"
  echo "${tier:-repo}"
}

# _config_read_value <key>
#   Prints the raw (jq -c) value of <key> under NAMESPACE, or nothing,
#   mirroring NamespacedBooleanKeyConfig#_readValue/#_readNewValue
#   (core/lib/utils/config/NamespacedBooleanKeyConfig.js):
#     1. a key registered in shared/lib/config/keys.json is read through
#        config_chain_read, i.e. from the tiers the registry allows for
#        it (a `null` value resolves to empty here);
#     2. an unregistered key gets a direct, presence-checked read of
#        the repo tier file (so an explicit `null` prints `null`).
#   The legacy .claude/configuration/auto-fix-all.json is never read.
#   Always exits 0; callers apply their own default.
_config_read_value() {
  local key="$1" value

  if key_registry_has_key "${NAMESPACE}.${key}"; then
    # config-key: auto-fix-all.clear_context
    # config-key: auto-fix-all.finish_on_empty_queue
    # config-key: auto-fix-all.ignored_check_patterns
    value=$(config_chain_read "." "$NAMESPACE" "$key")
  else
    # config-key: auto-fix-all.clear_context
    # config-key: auto-fix-all.finish_on_empty_queue
    # config-key: auto-fix-all.ignored_check_patterns
    value=$(config_tier_read "." repo "$NAMESPACE" "$key")
  fi

  [[ -n "$value" ]] && echo "$value"
  return 0
}
