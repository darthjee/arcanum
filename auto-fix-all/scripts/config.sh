#!/usr/bin/env bash
# Config management for auto-fix-all.
# Usage: config.sh get <key>
#        config.sh is-enabled <key>
#        config.sh set <key> true|false
#        config.sh toggle <key>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE=".claude/configuration/auto-fix-all.json"
LOCK_FILE=".claude/state/auto-fix-all-config.lock"
STATE_DIR=".claude/state"

mkdir -p "$STATE_DIR"

# shellcheck source=../../_lib/lock.sh
source "${SCRIPT_DIR}/../../_lib/lock.sh"

# Reads the config object from CONFIG_FILE, or "{}" if absent/empty.
_read_config() {
  if [[ -s "$CONFIG_FILE" ]]; then
    cat "$CONFIG_FILE"
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
    _read_config | jq -r --arg k "$KEY" '.[$k] // false'
    ;;

  is-enabled)
    if [[ $# -lt 2 ]]; then
      echo "Error: is-enabled requires a key" >&2
      exit 1
    fi
    KEY="$2"
    VALUE=$(_read_config | jq -r --arg k "$KEY" '.[$k] // false')
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
    _acquire_lock
    _read_config | jq --arg k "$KEY" --arg v "$VALUE" '.[$k] = ($v == "true")' > "${CONFIG_FILE}.tmp"
    mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
    _release_lock
    ;;

  toggle)
    if [[ $# -lt 2 ]]; then
      echo "Error: toggle requires a key" >&2
      exit 1
    fi
    KEY="$2"
    _acquire_lock
    CURRENT=$(_read_config | jq -r --arg k "$KEY" '.[$k] // false')
    if [[ "$CURRENT" == "true" ]]; then
      NEW_VALUE="false"
    else
      NEW_VALUE="true"
    fi
    _read_config | jq --arg k "$KEY" --arg v "$NEW_VALUE" '.[$k] = ($v == "true")' > "${CONFIG_FILE}.tmp"
    mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
    _release_lock
    echo "$NEW_VALUE"
    ;;

  *)
    echo "Usage: $0 {get <key>|is-enabled <key>|set <key> true|false|toggle <key>}" >&2
    exit 1
    ;;
esac
