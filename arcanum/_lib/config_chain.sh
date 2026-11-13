# shellcheck shell=bash
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
# shellcheck source=key_registry.sh
source "${_CONFIG_CHAIN_LIB_DIR}/key_registry.sh"

# The local and repo tier files, relative to the caller's cwd (the
# target project's root); the global one is global_config.sh's.
_CONFIG_CHAIN_LOCAL_FILE=".claude/state/arcanum-config.json"
_CONFIG_CHAIN_REPO_FILE=".claude/configuration/arcanum-repo-config.json"

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
#   Tier filter: before reading <namespace>.<key> in a tier, the key is
#   checked against the config key registry (shared/lib/config/keys.json)
#   with key_registry_allows_tier (see key_registry.sh, the shell mirror
#   of KeyRegistry#allowsTier). When it prints `false` (the matching
#   entry's `tiers` does not list that tier), the key is skipped in that
#   tier without reading the file. `true` and `null` (an unknown or
#   malformed key, or an unreadable registry) both read as usual. The
#   filter never reorders: precedence stays local, repo, global.
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
    [[ "$(key_registry_allows_tier "${namespace}.${key}" local)" == "false" ]] && continue
    value=$(repo_config_read "$_CONFIG_CHAIN_LOCAL_FILE" "" "$namespace" "$key")
    [[ -n "$value" && "$value" != "null" ]] && { echo "$value"; return 0; }
  done

  for key in "${keys[@]}"; do
    [[ "$(key_registry_allows_tier "${namespace}.${key}" repo)" == "false" ]] && continue
    value=$(repo_config_read "$_CONFIG_CHAIN_REPO_FILE" "" "$namespace" "$key")
    [[ -n "$value" && "$value" != "null" ]] && { echo "$value"; return 0; }
  done

  for key in "${keys[@]}"; do
    [[ "$(key_registry_allows_tier "${namespace}.${key}" global)" == "false" ]] && continue
    value=$(global_config_read "$repo_path" "$namespace" "$key")
    [[ -n "$value" && "$value" != "null" ]] && { echo "$value"; return 0; }
  done

  return 0
}

# config_tier_read <repo_path> <tier> <namespace> <key>
#   Single-tier read of <namespace>.<key> from the file of <tier> (local,
#   repo or global, the files config_chain_read walks), with that tier's
#   reader's presence-checked semantics (an explicit `null` prints
#   `null`; nothing falls through to another tier and the registry's
#   tier filter is not applied). Prints nothing for an absent key or an
#   unknown <tier>. Always exits 0.
config_tier_read() {
  local repo_path="$1" tier="$2" namespace="$3" key="$4"

  case "$tier" in
    local) repo_config_read "$_CONFIG_CHAIN_LOCAL_FILE" "" "$namespace" "$key" ;;
    repo) repo_config_read "$_CONFIG_CHAIN_REPO_FILE" "" "$namespace" "$key" ;;
    global) global_config_read "$repo_path" "$namespace" "$key" ;;
  esac
  return 0
}

# config_tier_write <repo_path> <tier> <namespace> <key> <json_value>
#   Writes <namespace>.<key> = <json_value> (a pre-formed JSON literal)
#   to the file of <tier> through that tier's writer: repo_config_write
#   for local/repo, global_config_write for global (which warns and
#   writes nothing, still exiting 0, when the global file can't be
#   resolved). An unknown <tier> errors on stderr and exits 1.
config_tier_write() {
  local repo_path="$1" tier="$2" namespace="$3" key="$4" json_value="$5"

  case "$tier" in
    local) repo_config_write "$_CONFIG_CHAIN_LOCAL_FILE" "" "$namespace" "$key" "$json_value" ;;
    repo) repo_config_write "$_CONFIG_CHAIN_REPO_FILE" "" "$namespace" "$key" "$json_value" ;;
    global) global_config_write "$repo_path" "$namespace" "$key" "$json_value" ;;
    *)
      echo "Error: unknown config tier '${tier}' (expected local, repo or global)" >&2
      return 1
      ;;
  esac
}
