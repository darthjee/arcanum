#!/usr/bin/env bash
# Continuous issue monitor for the current repository.
#
# Polls GitHub every 5 seconds for issues created/updated since the last
# check, parses tags from the issue body, and writes metadata to
# .claude/state/issues.json. Runs forever; stop with Ctrl-C or SIGTERM.
#
# Usage: monitor_issues.sh  (no arguments)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_lib_origin.sh
source "${SCRIPT_DIR}/_lib_origin.sh"
# shellcheck source=../../_lib/tags.sh
source "${SCRIPT_DIR}/../../_lib/tags.sh"

STATE_DIR=".claude/state"
ISSUES_FILE="${STATE_DIR}/issues.json"
LAST_CHECKED_FILE="${STATE_DIR}/issue-monitor-last-checked.txt"
LOCK_FILE="${STATE_DIR}/issue-monitor.lock"

mkdir -p "$STATE_DIR"

# --- Logging ---

_log() {
  echo "[$(date -u +%FT%TZ)] $*"
}

# --- Cross-platform date: now minus 1 second ---

_now_minus_1s() {
  if [[ "$(uname)" == "Darwin" ]]; then
    date -u -v-1S +%FT%TZ
  else
    date -u -d '-1 second' +%FT%TZ
  fi
}

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
        echo "Warning: issue-monitor lock ($LOCK_FILE) seems stuck after ${attempt} attempts — check whether a process is actually holding it, and if not, remove the lock file manually. Retrying..." >&2
        warned=true
      fi
      attempt=0
    fi
  done
}

_release_lock() {
  rm -f "$LOCK_FILE"
}

# Release lock on exit to avoid leaving it behind.
trap '_release_lock' EXIT

# --- State helpers ---

_read_issues() {
  if [[ -s "$ISSUES_FILE" ]]; then
    cat "$ISSUES_FILE"
  else
    echo '{}'
  fi
}

_write_issues() {
  local json="$1"
  echo "$json" > "${ISSUES_FILE}.tmp"
  mv "${ISSUES_FILE}.tmp" "$ISSUES_FILE"
}

_read_last_checked() {
  if [[ -s "$LAST_CHECKED_FILE" ]]; then
    cat "$LAST_CHECKED_FILE"
  else
    echo "1970-01-01T00:00:00Z"
  fi
}

# --- Main loop ---

_ensure_gh_user

REPO_REF=$(get_repo_ref)
GH_USER=$(get_gh_user)

_log "Starting issue monitor for repo=${REPO_REF} user=${GH_USER:-<default>}"

while true; do
  # a. Read the SINCE value saved at the START of the PREVIOUS round.
  SINCE=$(_read_last_checked)

  # b. Compute now minus 1 second.
  NOW_MINUS_1=$(_now_minus_1s)

  # c. Save NOW_MINUS_1 so the next round fetches everything from this moment.
  echo "$NOW_MINUS_1" > "$LAST_CHECKED_FILE"

  _log "Polling issues updated since $SINCE ..."

  # d. Fetch issues updated since SINCE.
  ISSUES_JSON=""
  if [[ -n "$GH_USER" ]]; then
    ISSUES_JSON=$(gh issue list \
      -R "$REPO_REF" \
      --author "$GH_USER" \
      --state all \
      --json number,title,updatedAt,body,labels \
      --search "updated:>$SINCE" \
      --limit 100 2>&1) || {
      _log "ERROR: gh issue list failed: $ISSUES_JSON" >&2
      sleep 5
      continue
    }
  else
    ISSUES_JSON=$(gh issue list \
      -R "$REPO_REF" \
      --state all \
      --json number,title,updatedAt,body,labels \
      --search "updated:>$SINCE" \
      --limit 100 2>&1) || {
      _log "ERROR: gh issue list failed: $ISSUES_JSON" >&2
      sleep 5
      continue
    }
  fi

  # Count how many issues were returned.
  ISSUE_COUNT=$(echo "$ISSUES_JSON" | jq 'length')
  _log "Got ${ISSUE_COUNT} issue(s) from GitHub."

  # 5. Process each issue.
  for i in $(seq 0 $((ISSUE_COUNT - 1))); do
    ISSUE=$(echo "$ISSUES_JSON" | jq ".[$i]")
    ISSUE_ID=$(echo "$ISSUE" | jq -r '.number | tostring')
    GH_UPDATED_AT=$(echo "$ISSUE" | jq -r '.updatedAt')

    # Read stored updated_at for this issue.
    STORED_UPDATED_AT=$(
      _read_issues | jq -r --arg id "$ISSUE_ID" '.[$id].updated_at // "1970-01-01T00:00:00Z"'
    )

    # Fine-grained guard: skip if not newer.
    if [[ "$GH_UPDATED_AT" <= "$STORED_UPDATED_AT" ]]; then
      _log "Skipping #${ISSUE_ID} — not newer (gh=${GH_UPDATED_AT} stored=${STORED_UPDATED_AT})"
      continue
    fi

    BODY=$(echo "$ISSUE" | jq -r '.body // ""')

    # Build tags JSON array from body.
    TAGS_JSON=$(extract_tags "$BODY" | jq -R . | jq -s .)

    NOW=$(date -u +%FT%TZ)

    # Acquire lock, merge, write, release.
    _acquire_lock
    CURRENT_ISSUES=$(_read_issues)
    UPDATED_ISSUES=$(
      echo "$CURRENT_ISSUES" | jq \
        --arg id "$ISSUE_ID" \
        --arg updated_at "$NOW" \
        --argjson tags "$TAGS_JSON" \
        '.[$id] = {"updated_at": $updated_at, "tags": $tags}'
    )
    _write_issues "$UPDATED_ISSUES"
    _release_lock

    _log "Processed #${ISSUE_ID} — tags: ${TAGS_JSON}"
  done

  sleep 5
done
