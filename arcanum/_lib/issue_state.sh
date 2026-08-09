#!/usr/bin/env bash
# Safe read/write of .claude/state/issue-<id>.json
#
# Usage:
#   issue_state.sh get <id> <field>                   → prints value or empty string, exits 0
#   issue_state.sh set <id> <field> <value>            → sets string field, exits 0
#   issue_state.sh set-json <id> <field> <json_value>  → sets JSON field (array/object), exits 0
#
# State file: .claude/state/issue-<id>.json
# Lock file:  .claude/state/issue-<id>.lock

set -uo pipefail

COMMAND="${1:-}"
ISSUE_ID="${2:-}"
FIELD="${3:-}"

if [[ -z "$COMMAND" || -z "$ISSUE_ID" || -z "$FIELD" ]]; then
  echo "Usage: $0 get <id> <field>" >&2
  echo "       $0 set <id> <field> <value>" >&2
  echo "       $0 set-json <id> <field> <json_value>" >&2
  exit 1
fi

STATE_DIR=".claude/state"
STATE_FILE="${STATE_DIR}/issue-${ISSUE_ID}.json"
LOCK_FILE="${STATE_DIR}/issue-${ISSUE_ID}.lock"

mkdir -p "$STATE_DIR"

# --- Lock helpers ---

_LOCK_INSTANCE_ID="${HOSTNAME:-host}-$$-$(date +%s%N)"

_acquire_lock() {
  local attempt=0
  local warned=false
  while true; do
    attempt=$((attempt + 1))
    echo "$_LOCK_INSTANCE_ID" > "$LOCK_FILE"
    sleep 1
    if [[ "$(cat "$LOCK_FILE" 2>/dev/null)" == "$_LOCK_INSTANCE_ID" ]]; then
      return 0
    fi
    if (( attempt % 10 == 0 )); then
      if [[ "$warned" == false ]]; then
        echo "Warning: issue state lock ($LOCK_FILE) seems stuck after ${attempt} attempts — check whether a process is actually holding it, and if not, remove the lock file manually. Retrying..." >&2
        warned=true
      fi
      attempt=0
    fi
  done
}

_release_lock() {
  rm -f "$LOCK_FILE"
}

# --- State helpers ---

_read_state() {
  if [[ -s "$STATE_FILE" ]]; then
    cat "$STATE_FILE"
  else
    echo '{}'
  fi
}

_write_state() {
  local json="$1"
  echo "$json" > "${STATE_FILE}.tmp"
  mv "${STATE_FILE}.tmp" "$STATE_FILE"
}

# --- Commands ---

case "$COMMAND" in
  get)
    jq -r --arg field "$FIELD" '.[$field] // empty' < <(_read_state) 2>/dev/null || true
    ;;

  set)
    VALUE="${4:-}"
    _acquire_lock
    trap '_release_lock' EXIT
    CURRENT=$(_read_state)
    UPDATED=$(echo "$CURRENT" | jq --arg field "$FIELD" --arg value "$VALUE" '.[$field] = $value')
    _write_state "$UPDATED"
    _release_lock
    trap - EXIT
    ;;

  set-json)
    JSON_VALUE="${4:-}"
    _acquire_lock
    trap '_release_lock' EXIT
    CURRENT=$(_read_state)
    UPDATED=$(echo "$CURRENT" | jq --arg field "$FIELD" --argjson value "$JSON_VALUE" '.[$field] = $value')
    _write_state "$UPDATED"
    _release_lock
    trap - EXIT
    ;;

  *)
    echo "Unknown command: $COMMAND" >&2
    echo "Usage: $0 get <id> <field>" >&2
    echo "       $0 set <id> <field> <value>" >&2
    echo "       $0 set-json <id> <field> <json_value>" >&2
    exit 1
    ;;
esac
