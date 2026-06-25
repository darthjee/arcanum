#!/usr/bin/env bash
# Continuous issue monitor for the current repository.
#
# Polls GitHub every 5 seconds for issues created/updated since the last
# check, parses tags from the issue body, and writes metadata to
# .claude/state/issues.json. Runs forever; stop with Ctrl-C or SIGTERM.
#
# Usage: monitor_issues.sh  (no arguments)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../_lib/origin.sh
source "${SCRIPT_DIR}/../../_lib/origin.sh"
# shellcheck source=../../_lib/tags.sh
source "${SCRIPT_DIR}/../../_lib/tags.sh"
# shellcheck source=../../_lib/tag_actions.sh
source "${SCRIPT_DIR}/../../_lib/tag_actions.sh"
# shellcheck source=../../_lib/lock.sh
source "${SCRIPT_DIR}/../../_lib/lock.sh"

QUEUE_SCRIPT="${SCRIPT_DIR}/../../auto-fix-all/scripts/queue.sh"
REWRITE_QUEUE_SCRIPT="${SCRIPT_DIR}/rewrite_queue.sh"
ISSUE_STATE_SCRIPT="${SCRIPT_DIR}/../../auto-fix-issue/scripts/issue_state.sh"

STATE_DIR=".claude/state"
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

# Release lock on exit to avoid leaving it behind.
trap '_release_lock' EXIT

# --- State helpers ---

_read_last_checked() {
  if [[ -s "$LAST_CHECKED_FILE" ]]; then
    cat "$LAST_CHECKED_FILE"
  else
    echo "1970-01-01T00:00:00Z"
  fi
}

# --- One poll cycle ---

_poll_once() {
  # a. Read the SINCE value saved at the START of the PREVIOUS round.
  local SINCE
  SINCE=$(_read_last_checked)

  # b. Compute now minus 1 second.
  local NOW_MINUS_1
  NOW_MINUS_1=$(_now_minus_1s)

  # c. Save NOW_MINUS_1 so the next round fetches everything from this moment.
  echo "$NOW_MINUS_1" > "$LAST_CHECKED_FILE"

  _log "Polling issues updated since $SINCE ..."

  # d. Fetch issues updated since SINCE.
  local ISSUES_JSON
  if [[ -n "$GH_USER" ]]; then
    ISSUES_JSON=$(gh issue list \
      -R "$REPO_REF" \
      --author "$GH_USER" \
      --state open \
      --json number,title,updatedAt,body,labels \
      --search "updated:>$SINCE" \
      --limit 100 2>&1) || {
      _log "ERROR: gh issue list failed: $ISSUES_JSON"
      return 1
    }
  else
    ISSUES_JSON=$(gh issue list \
      -R "$REPO_REF" \
      --state open \
      --json number,title,updatedAt,body,labels \
      --search "updated:>$SINCE" \
      --limit 100 2>&1) || {
      _log "ERROR: gh issue list failed: $ISSUES_JSON"
      return 1
    }
  fi

  # Count how many issues were returned.
  local ISSUE_COUNT
  ISSUE_COUNT=$(echo "$ISSUES_JSON" | jq 'length')
  _log "Got ${ISSUE_COUNT} issue(s) from GitHub."

  # Process each issue.
  if (( ISSUE_COUNT > 0 )); then
    local i
    for i in $(seq 0 $((ISSUE_COUNT - 1))); do
      local ISSUE ISSUE_ID GH_UPDATED_AT STORED_UPDATED_AT BODY TAGS_JSON NOW
      ISSUE=$(echo "$ISSUES_JSON" | jq ".[$i]")
      ISSUE_ID=$(echo "$ISSUE" | jq -r '.number | tostring')
      GH_UPDATED_AT=$(echo "$ISSUE" | jq -r '.updatedAt')

      # Read stored updated_at for this issue.
      STORED_UPDATED_AT=$("$ISSUE_STATE_SCRIPT" get "$ISSUE_ID" updated_at)
      STORED_UPDATED_AT="${STORED_UPDATED_AT:-1970-01-01T00:00:00Z}"

      # Fine-grained guard: skip if not newer.
      if [[ ! "$GH_UPDATED_AT" > "$STORED_UPDATED_AT" ]]; then
        _log "Skipping #${ISSUE_ID} — not newer (gh=${GH_UPDATED_AT} stored=${STORED_UPDATED_AT})"
        continue
      fi

      BODY=$(echo "$ISSUE" | jq -r '.body // ""')

      # Build tags JSON array from body.
      TAGS_JSON=$(extract_tags "$BODY" | jq -R . | jq -s .)

      _log "Processing #${ISSUE_ID} — tags: ${TAGS_JSON}"

      # Dispatch any actionable tags found on this issue. `question` has no
      # dispatched action (it needs AI judgment to answer, left to a future
      # architect-level step) and is log-only. `clipboard` (push to the
      # auto-fix queue) and `pencil2` (push to the rewrite queue) are fully
      # deterministic dispatches handled here directly. `updated_at` for
      # this issue is only recorded once all dispatched actions for it have
      # succeeded — see below — so a failed dispatch gets retried next poll.
      local ISSUE_DISPATCH_FAILED=0
      local ACTION_TAG
      while IFS= read -r ACTION_TAG; do
        [[ -z "$ACTION_TAG" ]] && continue
        case "$ACTION_TAG" in
          question)
            _log "Issue #${ISSUE_ID} has actionable tag 'question' — needs an answer from the agent"
            ;;
          pencil2)
            _log "Issue #${ISSUE_ID} has actionable tag 'pencil2' — pushing to rewrite queue"
            "$REWRITE_QUEUE_SCRIPT" push "$ISSUE_ID" || { _log "ERROR: failed to push #${ISSUE_ID} to the rewrite queue"; ISSUE_DISPATCH_FAILED=1; }
            ;;
          clipboard)
            _log "Issue #${ISSUE_ID} has actionable tag 'clipboard' — pushing to auto-fix-all queue"
            "$QUEUE_SCRIPT" push "$ISSUE_ID" || { _log "ERROR: failed to push #${ISSUE_ID} to the queue"; ISSUE_DISPATCH_FAILED=1; }
            ;;
        esac
      done < <(actionable_tags "$BODY")

      if [[ "$ISSUE_DISPATCH_FAILED" -eq 0 ]]; then
        NOW=$(date -u +%FT%TZ)

        # Write per-issue state file via issue_state.sh (handles its own locking).
        "$ISSUE_STATE_SCRIPT" set "$ISSUE_ID" updated_at "$NOW"
        "$ISSUE_STATE_SCRIPT" set-json "$ISSUE_ID" tags "$TAGS_JSON"

        _log "Processed #${ISSUE_ID} — updated_at recorded"
      else
        _log "Skipping updated_at write for #${ISSUE_ID} — a dispatched action failed; will retry next poll"
      fi
    done
  fi
}

# --- Main loop ---

_ensure_gh_user

REPO_REF=$(get_repo_ref)
GH_USER=$(get_gh_user)

_log "Starting issue monitor for repo=${REPO_REF} user=${GH_USER:-<default>}"

while true; do
  _poll_once || _log "ERROR in poll cycle — retrying after sleep"
  sleep 5
done
