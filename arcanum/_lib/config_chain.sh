# Composing 3-tier config chain reader — the single place that owns the
# full "local repo state -> repo config -> global user config" lookup,
# instead of every caller manually re-chaining
# repo_config_read/global_config_read by hand.
#
# See docs/agents/architecture/shared-state-and-configuration.md for the
# three files this reads, and arcanum/_lib/global_config.sh's header for
# the outermost (global) tier.
#
# This file is meant to be SOURCED, not executed directly.

_CONFIG_CHAIN_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=repo_config.sh
source "${_CONFIG_CHAIN_LIB_DIR}/repo_config.sh"
# shellcheck source=global_config.sh
source "${_CONFIG_CHAIN_LIB_DIR}/global_config.sh"

# config_chain_read <repo_path> <namespace> <key>
#   Reads <namespace>.<key> across all three config tiers, in order,
#   returning the first present-and-non-null value found:
#     1. Local state   (.claude/state/arcanum-config.json)
#     2. Repo config    (.claude/configuration/arcanum-repo-config.json)
#     3. Global config   (see global_config.sh)
#   A JSON `null` value at any tier is treated the same as absent, and
#   falls through to the next tier (repo_config_read's own presence
#   check treats `null` as present — this is the one place that
#   null-vs-absent distinction is re-applied, now that it's centralized
#   here instead of duplicated per caller). An explicit empty string
#   ("") is a real value and stops the chain there.
#
#   Prints the raw value (same shape repo_config_read/global_config_read
#   print — jq -c compact), or nothing if all three tiers are empty/
#   null. Always exits 0 — callers apply their own hardcoded default on
#   top of an empty result, same convention as every individual reader.
config_chain_read() {
  local repo_path="$1" namespace="$2" key="$3"
  local value

  value=$(repo_config_read ".claude/state/arcanum-config.json" "" "$namespace" "$key")
  [[ -n "$value" && "$value" != "null" ]] && { echo "$value"; return 0; }

  value=$(repo_config_read ".claude/configuration/arcanum-repo-config.json" "" "$namespace" "$key")
  [[ -n "$value" && "$value" != "null" ]] && { echo "$value"; return 0; }

  value=$(global_config_read "$repo_path" "$namespace" "$key")
  [[ -n "$value" && "$value" != "null" ]] && { echo "$value"; return 0; }

  return 0
}
