# shellcheck shell=bash
# Shell mirror of the config key registry's lookup/tier check
# (shared/lib/config/KeyRegistry.js's `lookup` and `allowsTier`).
#
# This file is meant to be SOURCED, not executed directly — it defines
# functions used by config_chain.sh (to skip the tiers a key is not
# allowed in) and by readers that need to know whether a key is
# registered at all. See
# docs/agents/architecture/shared-state-and-configuration.md#the-key-registry.
#
# The registry read is KEY_REGISTRY_FILE when set and non-empty, else
# shared/lib/config/keys.json resolved relative to this file (never the
# cwd, so it works under engine dispatch's `env -i` and inside Docker).
# All matching is done in a single jq program; bash 3.2 compatible.
#
# Guard against double-sourcing:
[[ -n "${_LIB_KEY_REGISTRY_LOADED:-}" ]] && return 0
_LIB_KEY_REGISTRY_LOADED=1

_KEY_REGISTRY_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_KEY_REGISTRY_DEFAULT_FILE="${_KEY_REGISTRY_LIB_DIR}/../../shared/lib/config/keys.json"
_KEY_REGISTRY_KEY_PATTERN='^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$'

# _key_registry_lookup <full_key> <tier>
#   Finds the entry matching <full_key> (a literal entry beats a
#   wildcard one; otherwise the first entry, in registry order, with the
#   same segment count whose every segment is equal or a `<name>`
#   wildcard). With a non-empty <tier>, prints `true`/`false` (whether
#   the entry's `tiers` includes it) or `null` (no match). With an empty
#   <tier>, prints `match` or `null`. A malformed key, or a missing,
#   unreadable or broken registry, prints `null`. Never writes to
#   stderr; always exits 0.
_key_registry_lookup() {
  local key="$1" tier="$2"
  local file="${KEY_REGISTRY_FILE:-$_KEY_REGISTRY_DEFAULT_FILE}"
  local result

  if [[ ! "$key" =~ $_KEY_REGISTRY_KEY_PATTERN ]] || [[ ! -f "$file" || ! -r "$file" ]]; then
    echo "null"
    return 0
  fi

  # shellcheck disable=SC2016
  result=$(jq -r --arg key "$key" --arg tier "$tier" '
    def wild: test("^<[A-Za-z0-9_-]+>$");
    ($key | split(".")) as $segs
    | if (.keys | type) != "array" then error("no keys array") else . end
    | [.keys[] | select(type == "object" and (.key | type) == "string")] as $entries
    | (
        ([$entries[] | select(.key == $key)] | first)
        // ([$entries[]
              | select(
                  (.key | split(".")) as $es
                  | ($es | length) == ($segs | length)
                    and ([range(0; $es | length) as $i
                          | (($es[$i] | wild) or $es[$i] == $segs[$i])] | all)
                )
            ] | first)
      ) as $entry
    | if $entry == null then "null"
      elif $tier == "" then "match"
      elif ((($entry.tiers // []) | if type == "array" then . else [] end) | any(. == $tier)) then "true"
      else "false"
      end
  ' "$file" 2>/dev/null) || result=""

  case "$result" in
    true|false|match) echo "$result" ;;
    *) echo "null" ;;
  esac
  return 0
}

# key_registry_allows_tier <full_key> <tier>
#   Prints exactly one line: `true` when the registry entry matching
#   <full_key> lists <tier> in its `tiers`, `false` when it doesn't, and
#   `null` when no entry matches, the key is malformed, the registry is
#   missing/broken, or <tier> is not one of local, repo, global. Callers
#   treat `null` as allowed. Always exits 0.
key_registry_allows_tier() {
  local key="$1" tier="$2"

  case "$tier" in
    local|repo|global) ;;
    *) echo "null"; return 0 ;;
  esac

  _key_registry_lookup "$key" "$tier"
}

# key_registry_has_key <full_key>
#   Exits 0 when a registry entry matches <full_key> (same rules as
#   key_registry_allows_tier), 1 otherwise (including a malformed key or
#   a missing/broken registry). Prints nothing.
key_registry_has_key() {
  [[ "$(_key_registry_lookup "$1" "")" == "match" ]]
}
