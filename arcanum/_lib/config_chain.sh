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

# config_chain_read <repo_path> <namespace> <key1> [<key2> ...]
#   Reads <namespace>.<key1>[, <namespace>.<key2>, ...] across all three
#   config tiers, in order, returning the first present-and-non-null
#   value found:
#     1. Local state   (.claude/state/arcanum-config.json)
#     2. Repo config    (.claude/configuration/arcanum-repo-config.json)
#     3. Global config   (see global_config.sh)
#   Within each tier, the given keys are tried in order and the first
#   one that resolves there wins; only once every key has been tried
#   and found absent/null in the current tier does the chain advance to
#   the next tier. This means a tier is always fully resolved before
#   the next one is ever consulted — e.g. a generic key set at a
#   higher-precedence tier still beats a more specific key set at a
#   lower-precedence tier. A single key is the degenerate case of this
#   loop, so existing single-key callers are unaffected.
#
#   Each <key> may itself be a dot-separated nested path (see
#   repo_config_read/global_config_read). A JSON `null` value at any
#   tier/key is treated the same as absent, and falls through (first to
#   the next key in the same tier, then to the next tier — this is the
#   one place that null-vs-absent distinction is re-applied, now that
#   it's centralized here instead of duplicated per caller). An
#   explicit empty string ("") is a real value and stops the chain
#   there.
#
#   Prints the raw value (same shape repo_config_read/global_config_read
#   print — jq -c compact), or nothing if all keys in all three tiers
#   are empty/null. Always exits 0 — callers apply their own hardcoded
#   default on top of an empty result, same convention as every
#   individual reader.
config_chain_read() {
  local repo_path="$1" namespace="$2"
  shift 2
  local keys=("$@")
  local value key

  for key in "${keys[@]}"; do
    value=$(repo_config_read ".claude/state/arcanum-config.json" "" "$namespace" "$key")
    [[ -n "$value" && "$value" != "null" ]] && { echo "$value"; return 0; }
  done

  for key in "${keys[@]}"; do
    value=$(repo_config_read ".claude/configuration/arcanum-repo-config.json" "" "$namespace" "$key")
    [[ -n "$value" && "$value" != "null" ]] && { echo "$value"; return 0; }
  done

  for key in "${keys[@]}"; do
    value=$(global_config_read "$repo_path" "$namespace" "$key")
    [[ -n "$value" && "$value" != "null" ]] && { echo "$value"; return 0; }
  done

  return 0
}
