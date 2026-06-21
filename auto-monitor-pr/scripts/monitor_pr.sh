#!/usr/bin/env bash
# Monitor a PR for merge/close/approval/new-comments from its owner
# Usage: monitor_pr.sh <pr_number>
#
# Resolves PR_OWNER via get_gh_user and derives SINCE_FILE as
# .claude/state/auto-monitor-pr-<pr_number>-since.txt.
#
# Blocking loop (5s sleep) that polls `gh pr view --json state,comments,reviews`
# plus the inline review comments API, retrying silently on transient gh
# errors. The since-file is a plain-text file holding a single ISO8601
# timestamp line, the last-seen comment time. If the file is missing,
# "1970-01-01T00:00:00Z" is assumed.
#
# Behavior:
#   - PR state MERGED  -> print "merged", exit 0
#   - PR state CLOSED  -> print "closed", exit 0
#   - latest review by <pr_owner> is APPROVED -> print "approved", exit 0
#   - else collect comments (issue-level + inline + review bodies) from
#     <pr_owner> newer than the since-file timestamp; if any are found, write the max of
#     their timestamps into <since_file> (creating its parent dir if
#     needed); if any of those new comments is exactly ":shipit:" print
#     "approved" and exit 0; otherwise print "commented" followed by each
#     new comment's body (each preceded by a "---" line), exit 0
#   - otherwise sleep 5s and loop

set -euo pipefail

export GH_INSECURE_SKIP_VERIFY=true

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_lib_origin.sh"

PR_NUMBER="${1:-}"
PR_NUMBER="${PR_NUMBER#\#}"

[[ -n "$PR_NUMBER" ]] || {
  echo "Usage: $0 <pr_number>" >&2
  exit 1
}

_ensure_gh_user
PR_OWNER=$(get_gh_user)
REPO_REF=$(get_repo_ref)
SINCE_FILE=".claude/state/auto-monitor-pr-${PR_NUMBER}-since.txt"

while true; do
  pr_data=$(gh pr view "$PR_NUMBER" -R "$REPO_REF" --json state,comments,reviews 2>/dev/null) || {
    sleep 5
    continue
  }

  state=$(echo "$pr_data" | jq -r '.state' 2>/dev/null) || { sleep 5; continue; }

  if [[ "$state" == "MERGED" ]]; then
    echo "merged"
    exit 0
  fi

  if [[ "$state" == "CLOSED" ]]; then
    echo "closed"
    exit 0
  fi

  # Check approval: only the LATEST review from the owner counts
  latest_review_state=$(echo "$pr_data" | jq -r \
    --arg owner "$PR_OWNER" \
    '[.reviews[] | select(.author.login == $owner)] | sort_by(.submittedAt) | last | .state' \
    2>/dev/null) || { sleep 5; continue; }

  if [[ "$latest_review_state" == "APPROVED" ]]; then
    echo "approved"
    exit 0
  fi

  # Fetch inline review comments (different endpoint, different field names)
  review_comments=$(gh api "repos/${REPO_REF}/pulls/${PR_NUMBER}/comments" 2>/dev/null) || {
    sleep 5
    continue
  }

  # Normalize all sources to {login, createdAt, body}
  all_comments=$(jq -n \
    --argjson conv "$pr_data" \
    --argjson inline "$review_comments" \
    '[$conv.comments[] | {login: .author.login, createdAt: .createdAt, body: .body}] +
     [$inline[] | {login: .user.login, createdAt: .created_at, body: .body}] +
     [$conv.reviews[] | select(.body != null and (.body | gsub("[[:space:]]"; "") != "")) | {login: .author.login, createdAt: .submittedAt, body: .body}]' \
    2>/dev/null) || { sleep 5; continue; }

  last_time="1970-01-01T00:00:00Z"
  if [[ -f "$SINCE_FILE" ]]; then
    file_time=$(head -1 "$SINCE_FILE" 2>/dev/null || true)
    [[ -n "$file_time" ]] && last_time="$file_time"
  fi

  new_comments=$(echo "$all_comments" | jq \
    --arg owner "$PR_OWNER" \
    --arg since "$last_time" \
    '[.[] | select(.login == $owner and .createdAt > $since)]' \
    2>/dev/null) || { sleep 5; continue; }

  count=$(echo "$new_comments" | jq 'length' 2>/dev/null) || { sleep 5; continue; }

  if [[ "$count" -gt 0 ]]; then
    latest_time=$(echo "$new_comments" | jq -r '[.[].createdAt] | max' 2>/dev/null) || { sleep 5; continue; }
    mkdir -p "$(dirname "$SINCE_FILE")"
    echo "$latest_time" > "$SINCE_FILE"

    shipit_count=$(echo "$new_comments" | jq \
      '[.[] | select(.body | test("^[[:space:]]*:shipit:[[:space:]]*$"))] | length' \
      2>/dev/null) || { sleep 5; continue; }

    if [[ "$shipit_count" -gt 0 ]]; then
      echo "approved"
      exit 0
    fi

    echo "commented"
    echo "$new_comments" | jq -r '.[] | "---\n" + .body'
    exit 0
  fi

  sleep 5
done
