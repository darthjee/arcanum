#!/usr/bin/env bash
# Monitor a PR for merge/close/approval/new-comments from its owner
# Usage: monitor_pr.sh <pr_number> <pr_owner> <since_file>
#        monitor_pr.sh monitor <issue_id>
#   The "monitor <issue_id>" form resolves PR_OWNER via get_gh_user, resolves
#   PR_NUMBER from the current branch's PR (same pattern as github.sh's
#   cmd_pr_number), and derives SINCE_FILE as
#   .claude/state/auto-fix-all-<issue_id>-since.txt; it then falls through
#   into the same monitoring loop as the explicit-args form.
#
# Blocking loop (5s sleep) that polls `gh pr view --json state,comments,reviews`
# plus the inline review comments API, retrying silently on transient gh
# errors. Generalized + simplified version of majora's cmd_monitor_pr: there
# is no JSON metadata file — instead <since_file> is a plain-text file
# (created by the caller's choosing, e.g. under .claude/state/) holding a
# single ISO8601 timestamp line, the last-seen comment time. If the file is
# missing, "1970-01-01T00:00:00Z" is assumed.
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

# --- Origin helpers (cached) ---
# Duplicated verbatim from github.sh: self-contained script, no sourcing
# across scripts.

_ORIGIN_PARSED=0
_ORIGIN_DOMAIN=""
_ORIGIN_REPO_PATH=""

_load_origin() {
  [[ "$_ORIGIN_PARSED" -eq 1 ]] && return 0

  local origin
  origin=$(git remote get-url origin 2>/dev/null) || {
    echo "Error: not a git repository or no 'origin' remote" >&2
    exit 1
  }

  if [[ "$origin" =~ ^git@ ]]; then
    _ORIGIN_DOMAIN="${origin#git@}"
    _ORIGIN_DOMAIN="${_ORIGIN_DOMAIN%%:*}"
    _ORIGIN_REPO_PATH="${origin#*:}"
    _ORIGIN_REPO_PATH="${_ORIGIN_REPO_PATH%.git}"
  elif [[ "$origin" =~ ^https?:// ]]; then
    local stripped="${origin#*://}"
    _ORIGIN_DOMAIN="${stripped%%/*}"
    _ORIGIN_REPO_PATH="${stripped#*/}"
    _ORIGIN_REPO_PATH="${_ORIGIN_REPO_PATH%.git}"
  else
    echo "Error: unrecognized origin format: $origin" >&2
    exit 1
  fi

  _ORIGIN_PARSED=1
}

get_repo_ref() {
  _load_origin
  if [[ "$_ORIGIN_DOMAIN" == "github.com" ]]; then
    echo "$_ORIGIN_REPO_PATH"
  else
    echo "$_ORIGIN_DOMAIN/$_ORIGIN_REPO_PATH"
  fi
}

get_gh_user() {
  git config user.ghuser 2>/dev/null || git config --global user.ghuser 2>/dev/null || true
}

_ensure_gh_user() {
  local ghuser
  ghuser=$(get_gh_user)
  if [[ -n "$ghuser" ]]; then
    gh auth switch --user "$ghuser" >/dev/null 2>&1 || \
      echo "Warning: gh auth switch --user $ghuser failed; proceeding with current gh user" >&2
  fi
}

if [[ "${1:-}" == "monitor" ]]; then
  issue_id="${2:-}"
  [[ -n "$issue_id" ]] || {
    echo "Usage: $0 monitor <issue_id>" >&2
    echo "       $0 <pr_number> <pr_owner> <since_file>" >&2
    exit 1
  }

  _ensure_gh_user
  PR_OWNER=$(get_gh_user)

  repo_ref=$(get_repo_ref)
  branch=$(git branch --show-current)

  PR_NUMBER=$(gh pr view -R "$repo_ref" "$branch" --json number -q '.number' 2>/dev/null) || {
    echo "Error: no pull request found for the current branch on $repo_ref" >&2
    exit 1
  }

  [[ -n "$PR_NUMBER" ]] || {
    echo "Error: no pull request found for the current branch on $repo_ref" >&2
    exit 1
  }

  SINCE_FILE=".claude/state/auto-fix-all-${issue_id}-since.txt"
else
  PR_NUMBER="${1:-}"
  PR_OWNER="${2:-}"
  SINCE_FILE="${3:-}"

  [[ -n "$PR_NUMBER" && -n "$PR_OWNER" && -n "$SINCE_FILE" ]] || {
    echo "Usage: $0 <pr_number> <pr_owner> <since_file>" >&2
    echo "       $0 monitor <issue_id>" >&2
    exit 1
  }
fi

_ensure_gh_user
REPO_REF=$(get_repo_ref)

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
