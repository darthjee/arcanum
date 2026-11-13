# shellcheck shell=bash
# Shell mirror of the config key registry's lookup/tier/default-tier checks
# (shared/lib/config/KeyRegistry.js's `lookup`, `allowsTier` and `defaultTier`).
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

# _key_registry_lookup <full_key> <mode> [<tier>]
#   Finds the entry matching <full_key> (a literal entry beats a
#   wildcard one; otherwise the first entry, in registry order, with the
#   same segment count whose every segment is equal or a `<name>`
#   wildcard) and prints, by <mode>:
#     allows        `true`/`false` (whether the entry's `tiers` includes
#                   <tier>);
#     match         `match`;
#     default_tier  the entry's default write tier (KeyRegistry's
#                   #defaultTier rule: `default_tier` if set, else the
#                   only tier when `tiers` has one, else `local` if
#                   `tiers` includes it, else `tiers[0]`), or `null`
#                   when that is not one of local, repo, global.
#   Prints `null` when no entry matches, or for a malformed key or a
#   missing, unreadable or broken registry. Never writes to stderr;
#   always exits 0.
_key_registry_lookup() {
  local key="$1" mode="$2" tier="${3:-}"
  local file="${KEY_REGISTRY_FILE:-$_KEY_REGISTRY_DEFAULT_FILE}"
  local result

  if [[ ! "$key" =~ $_KEY_REGISTRY_KEY_PATTERN ]] || [[ ! -f "$file" || ! -r "$file" ]]; then
    echo "null"
    return 0
  fi

  # shellcheck disable=SC2016
  result=$(jq -r --arg key "$key" --arg mode "$mode" --arg tier "$tier" '
    def wild: test("^<[A-Za-z0-9_-]+>$");
    def tiers_of: (.tiers // []) | if type == "array" then . else [] end;
    def default_tier_of:
      tiers_of as $tiers
      | if (.default_tier | type) == "string" then .default_tier
        elif ($tiers | length) == 1 then $tiers[0]
        elif ($tiers | any(. == "local")) then "local"
        else ($tiers[0] // "null")
        end
      | if type == "string" and (. == "local" or . == "repo" or . == "global") then . else "null" end;
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
      elif $mode == "match" then "match"
      elif $mode == "default_tier" then ($entry | default_tier_of)
      elif $mode == "allows" and ($entry | tiers_of | any(. == $tier)) then "true"
      elif $mode == "allows" then "false"
      else "null"
      end
  ' "$file" 2>/dev/null) || result=""

  case "$mode:$result" in
    allows:true|allows:false|match:match) echo "$result" ;;
    default_tier:local|default_tier:repo|default_tier:global) echo "$result" ;;
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

  _key_registry_lookup "$key" allows "$tier"
}

# key_registry_has_key <full_key>
#   Exits 0 when a registry entry matches <full_key> (same rules as
#   key_registry_allows_tier), 1 otherwise (including a malformed key or
#   a missing/broken registry). Prints nothing.
key_registry_has_key() {
  [[ "$(_key_registry_lookup "$1" match)" == "match" ]]
}

# key_registry_default_tier <full_key>
#   Prints the default write tier (local, repo or global) of the registry
#   entry matching <full_key> (same matching as key_registry_allows_tier;
#   the rule is KeyRegistry#defaultTier's, see _key_registry_lookup), or
#   nothing when no entry matches, the key is malformed or the registry
#   is missing/broken. Callers apply their own fallback (the config
#   writers use `repo`). Never writes to stderr; always exits 0.
key_registry_default_tier() {
  local tier
  tier="$(_key_registry_lookup "$1" default_tier)"
  [[ "$tier" != "null" ]] && echo "$tier"
  return 0
}
