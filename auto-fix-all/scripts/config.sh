#!/usr/bin/env bash
# Config management for auto-fix-all.
# Usage: config.sh get <key>
#        config.sh is-enabled <key>
#        config.sh set <key> true|false
#        config.sh toggle <key>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE=".claude/configuration/auto-fix-all.json"
NEW_CONFIG_FILE=".claude/configuration/arcanum-repo-config.json"
NEW_STATE_FILE=".claude/state/arcanum-config.json"
NAMESPACE="auto-fix-all"

# shellcheck source=../../arcanum/_lib/repo_config.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/repo_config.sh"

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

case ${1:-} in
  get)
    if [[ $# -lt 2 ]]; then
      echo "Error: get requires a key" >&2
      exit 1
    fi
    KEY="$2"
    VALUE=$(repo_config_read "$(_new_file_for_key "$KEY")" "$(_legacy_file_for_key "$KEY")" "$NAMESPACE" "$KEY")
    VALUE="${VALUE:-false}"
    echo "$VALUE"
    ;;

  is-enabled)
    if [[ $# -lt 2 ]]; then
      echo "Error: is-enabled requires a key" >&2
      exit 1
    fi
    KEY="$2"
    VALUE=$(repo_config_read "$(_new_file_for_key "$KEY")" "$(_legacy_file_for_key "$KEY")" "$NAMESPACE" "$KEY")
    VALUE="${VALUE:-false}"
    [[ "$VALUE" == "true" ]]
    ;;

  set)
    if [[ $# -lt 3 ]]; then
      echo "Error: set requires a key and a value (true|false)" >&2
      exit 1
    fi
    KEY="$2"
    VALUE="$3"
    if [[ "$VALUE" != "true" && "$VALUE" != "false" ]]; then
      echo "Error: value must be 'true' or 'false'" >&2
      exit 1
    fi
    repo_config_write "$(_new_file_for_key "$KEY")" "$(_legacy_file_for_key "$KEY")" "$NAMESPACE" "$KEY" "$VALUE"
    ;;

  toggle)
    if [[ $# -lt 2 ]]; then
      echo "Error: toggle requires a key" >&2
      exit 1
    fi
    KEY="$2"
    CURRENT=$(repo_config_read "$(_new_file_for_key "$KEY")" "$(_legacy_file_for_key "$KEY")" "$NAMESPACE" "$KEY")
    CURRENT="${CURRENT:-false}"
    if [[ "$CURRENT" == "true" ]]; then
      NEW_VALUE="false"
    else
      NEW_VALUE="true"
    fi
    repo_config_write "$(_new_file_for_key "$KEY")" "$(_legacy_file_for_key "$KEY")" "$NAMESPACE" "$KEY" "$NEW_VALUE"
    echo "$NEW_VALUE"
    ;;

  *)
    echo "Usage: $0 {get <key>|is-enabled <key>|set <key> true|false|toggle <key>}" >&2
    exit 1
    ;;
esac
