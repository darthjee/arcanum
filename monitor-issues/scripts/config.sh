#!/usr/bin/env bash
# Config management for monitor-issues.
# Usage: config.sh get <key>
#        config.sh is-enabled <key>
#        config.sh set <key> true|false
#        config.sh toggle <key>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE=".claude/configuration/monitor-issues.json"
STATE_CONFIG_FILE=".claude/state/monitor-issues-config.json"
LOCK_FILE=".claude/state/monitor-issues-config.lock"
STATE_DIR=".claude/state"

mkdir -p "$STATE_DIR"

# shellcheck source=../../_lib/lock.sh
source "${SCRIPT_DIR}/../../_lib/lock.sh"

# Returns the file that a given key should be read from/written to:
# clear_context is personal, frequently-toggled state and lives in the
# gitignored STATE_CONFIG_FILE; every other key lives in the committed
# CONFIG_FILE.
_config_file_for_key() {
  [[ "$1" == "clear_context" ]] && echo "$STATE_CONFIG_FILE" || echo "$CONFIG_FILE"
}

# Reads the config object from the given file, or "{}" if absent/empty.
_read_config() {
  local f="$1"
  if [[ -s "$f" ]]; then
    cat "$f"
  else
    echo "{}"
  fi
}

case ${1:-} in
  get)
    if [[ $# -lt 2 ]]; then
      echo "Error: get requires a key" >&2
      exit 1
    fi
    KEY="$2"
    TARGET_FILE="$(_config_file_for_key "$KEY")"
    _read_config "$TARGET_FILE" | jq -r --arg k "$KEY" '.[$k] // false'
    ;;

  is-enabled)
    if [[ $# -lt 2 ]]; then
      echo "Error: is-enabled requires a key" >&2
      exit 1
    fi
    KEY="$2"
    TARGET_FILE="$(_config_file_for_key "$KEY")"
    VALUE=$(_read_config "$TARGET_FILE" | jq -r --arg k "$KEY" '.[$k] // false')
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
    TARGET_FILE="$(_config_file_for_key "$KEY")"
    _acquire_lock
    _read_config "$TARGET_FILE" | jq --arg k "$KEY" --arg v "$VALUE" '.[$k] = ($v == "true")' > "${TARGET_FILE}.tmp"
    mv "${TARGET_FILE}.tmp" "$TARGET_FILE"
    _release_lock
    ;;

  toggle)
    if [[ $# -lt 2 ]]; then
      echo "Error: toggle requires a key" >&2
      exit 1
    fi
    KEY="$2"
    TARGET_FILE="$(_config_file_for_key "$KEY")"
    _acquire_lock
    CURRENT=$(_read_config "$TARGET_FILE" | jq -r --arg k "$KEY" '.[$k] // false')
    if [[ "$CURRENT" == "true" ]]; then
      NEW_VALUE="false"
    else
      NEW_VALUE="true"
    fi
    _read_config "$TARGET_FILE" | jq --arg k "$KEY" --arg v "$NEW_VALUE" '.[$k] = ($v == "true")' > "${TARGET_FILE}.tmp"
    mv "${TARGET_FILE}.tmp" "$TARGET_FILE"
    _release_lock
    echo "$NEW_VALUE"
    ;;

  *)
    echo "Usage: $0 {get <key>|is-enabled <key>|set <key> true|false|toggle <key>}" >&2
    exit 1
    ;;
esac
