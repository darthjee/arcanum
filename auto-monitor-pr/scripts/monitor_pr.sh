#!/usr/bin/env bash
# Monitor a PR for merge/close/approval/new-comments from its owner
# Usage: monitor_pr.sh --pr-number <pr_number> [--issue-id <id>]
#
# Resolves PR_OWNER via get_gh_user and derives COMMENTS_FILE as
# .claude/state/auto-monitor-pr-<pr_number>-comments.json (when <id> is
# absent or empty) or reads/writes the `pr_comments` and `last_comment_time`
# fields inside .claude/state/issue-<id>.json (when <id> is non-empty).
#
# Blocking loop (5s sleep) that polls `gh pr view --json state,comments,reviews`
# plus the inline review comments API, retrying silently on transient gh
# errors. When --issue-id is provided the comments-state is a JSON object
# `{"pr_comments":[{id,user,url,state,emojis}],"last_comment_time":<ISO8601>}`
# tracking each owner comment's three-state lifecycle:
#   fetched    – comment seen and recorded; reaction not yet added
#   processing – :eyes: reaction added; waiting for a fix to be pushed
#   addressed  – fix pushed; :eyes: swapped for :+1:
# The `emojis` field lists the current reactions added by this script
# (e.g. [":eyes:"] or [":+1:"]).
# The last_comment_time is the ISO 8601 timestamp of the newest recorded
# comment, persisted across loop iterations and across separate invocations.
# If the file is missing, the timestamp defaults to "1970-01-01T00:00:00Z".
#
# Note: the deprecated per-PR file (.claude/state/auto-monitor-pr-<pr_number>
# -comments.json, used when --issue-id is absent) retains its own JSON object
# with a `comments` key and is not part of this change.
#
# On every invocation, before polling: any comment still marked "processing"
# in the issue state is assumed addressed by whatever triggered this fresh
# run (the only caller that restarts this script is auto-fix-all, after
# pushing a fix for previously-reported comments) -- its :eyes: reaction is
# swapped for :+1: (GitHub's reaction set has no check-mark), its state
# becomes "addressed", and its emojis field is updated to [":+1:"].
#
# Behavior:
#   - PR state MERGED  -> print "merged", exit 0
#   - PR state CLOSED  -> print "closed", exit 0
#   - latest review by <pr_owner> is APPROVED -> print "approved", exit 0
#   - else collect comments (issue-level + inline + review bodies, each with
#     its GraphQL node id and html url) from <pr_owner> newer than the
#     last_comment_time; if any are found, write the max of their timestamps
#     into last_comment_time; if any of those new comments is exactly
#     ":shipit:" print "approved" and exit 0; otherwise:
#       1. persist them as state "fetched" with emojis []
#       2. add an :eyes: reaction to each and persist them as "processing"
#          with emojis [":eyes:"]
#       3. print "commented" followed by each new comment as a
#          "---"-preceded block of "id: <id>", "url: <url>", then the body,
#          exit 0
#   - otherwise sleep 5s and loop

set -euo pipefail

export GH_INSECURE_SKIP_VERIFY=true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../_lib/origin.sh
source "${SCRIPT_DIR}/../../_lib/origin.sh"
# shellcheck source=../../_lib/push.sh
source "${SCRIPT_DIR}/../../_lib/push.sh"

ISSUE_STATE_SCRIPT="${SCRIPT_DIR}/../../auto-fix-issue/scripts/issue_state.sh"

PR_NUMBER=""
ISSUE_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pr-number)
      PR_NUMBER="${2:-}"
      shift 2
      ;;
    --issue-id)
      ISSUE_ID="${2:-}"
      shift 2
      ;;
    *)
      echo "Usage: $0 --pr-number <pr_number> [--issue-id <id>]" >&2
      exit 1
      ;;
  esac
done

PR_NUMBER="${PR_NUMBER#\#}"

[[ -n "$PR_NUMBER" ]] || {
  echo "Usage: $0 --pr-number <pr_number> [--issue-id <id>]" >&2
  exit 1
}

_ensure_gh_user
PR_OWNER=$(get_gh_user)
REPO_REF=$(get_repo_ref)
COMMENTS_FILE=".claude/state/auto-monitor-pr-${PR_NUMBER}-comments.json"

add_reaction() { # $1 = node id, $2 = ReactionContent (EYES|THUMBS_UP)
  gh api graphql -f query='mutation($id:ID!,$content:ReactionContent!){addReaction(input:{subjectId:$id,content:$content}){reaction{id}}}' -F id="$1" -F content="$2" >/dev/null 2>&1 || true
}

remove_reaction() { # $1 = node id, $2 = ReactionContent
  gh api graphql -f query='mutation($id:ID!,$content:ReactionContent!){removeReaction(input:{subjectId:$id,content:$content}){subject{id}}}' -F id="$1" -F content="$2" >/dev/null 2>&1 || true
}

load_comments_state() {
  if [[ -n "$ISSUE_ID" ]]; then
    local issue_file=".claude/state/issue-${ISSUE_ID}.json"
    if [[ -s "$issue_file" ]]; then
      local comments last_time
      comments=$(jq -c '.pr_comments // []' "$issue_file" 2>/dev/null || echo '[]')
      last_time=$(jq -r '.last_comment_time // "1970-01-01T00:00:00Z"' "$issue_file" 2>/dev/null || echo '1970-01-01T00:00:00Z')
      jq -n --argjson comments "$comments" --arg last_comment_time "$last_time" \
        '{"pr_comments": $comments, "last_comment_time": $last_comment_time}'
    else
      echo '{"pr_comments":[],"last_comment_time":"1970-01-01T00:00:00Z"}'
    fi
  else
    cat "$COMMENTS_FILE" 2>/dev/null || echo '{"pr_comments":[],"last_comment_time":"1970-01-01T00:00:00Z"}'
  fi
}

save_comments_state() {
  if [[ -n "$ISSUE_ID" ]]; then
    local comments last_time
    comments=$(echo "$1" | jq -c '.pr_comments // []')
    last_time=$(echo "$1" | jq -r '.last_comment_time // "1970-01-01T00:00:00Z"')
    "$ISSUE_STATE_SCRIPT" set-json "$ISSUE_ID" pr_comments "$comments"
    "$ISSUE_STATE_SCRIPT" set "$ISSUE_ID" last_comment_time "$last_time"
  else
    mkdir -p "$(dirname "$COMMENTS_FILE")"
    echo "$1" > "$COMMENTS_FILE"
  fi
}

# Resolve any comments left "processing" by a previous invocation -- this run
# was triggered by a push made in response to them, so they're now addressed.
comments_state=$(load_comments_state)
open_ids=$(echo "$comments_state" | jq -r '.pr_comments[] | select(.state == "processing") | .id')
if [[ -n "$open_ids" ]]; then
  while IFS= read -r node_id; do
    [[ -n "$node_id" ]] || continue
    remove_reaction "$node_id" EYES
    add_reaction "$node_id" THUMBS_UP
  done <<< "$open_ids"
  comments_state=$(echo "$comments_state" | jq '.pr_comments |= map(if .state == "processing" then (.state = "addressed" | .emojis = [":+1:"]) else . end)')
  save_comments_state "$comments_state"
fi

while true; do
  push_current_branch 2>/dev/null || true

  pr_data=$(gh pr view "$PR_NUMBER" -R "$REPO_REF" --json state,comments,reviews 2>/dev/null) || {
    sleep 5
    continue
  }

  state=$(echo "$pr_data" | jq -r '.state' 2>/dev/null) || { sleep 5; continue; }

  if [[ "$state" == "MERGED" ]]; then
    if [[ -n "$ISSUE_ID" ]]; then
      rm -f ".claude/state/issue-${ISSUE_ID}.json"
    else
      rm -f "$COMMENTS_FILE"
    fi
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

  # Normalize all sources to {login, createdAt, body, id, url}. The "id" is
  # a GraphQL node id (reactable via addReaction/removeReaction regardless
  # of comment type), already present in each of these responses.
  all_comments=$(jq -n \
    --argjson conv "$pr_data" \
    --argjson inline "$review_comments" \
    '[$conv.comments[] | {login: .author.login, createdAt: .createdAt, body: .body, id: .id, url: .url}] +
     [$inline[] | {login: .user.login, createdAt: .created_at, body: .body, id: .node_id, url: .html_url}] +
     [$conv.reviews[] | select(.body != null and (.body | gsub("[[:space:]]"; "") != "")) | {login: .author.login, createdAt: .submittedAt, body: .body, id: .id, url: .url}]' \
    2>/dev/null) || { sleep 5; continue; }

  last_time=$(echo "$comments_state" | jq -r '.last_comment_time // "1970-01-01T00:00:00Z"')

  new_comments=$(echo "$all_comments" | jq \
    --arg owner "$PR_OWNER" \
    --arg since "$last_time" \
    '[.[] | select(.login == $owner and .createdAt > $since)]' \
    2>/dev/null) || { sleep 5; continue; }

  count=$(echo "$new_comments" | jq 'length' 2>/dev/null) || { sleep 5; continue; }

  if [[ "$count" -gt 0 ]]; then
    latest_time=$(echo "$new_comments" | jq -r '[.[].createdAt] | max' 2>/dev/null) || { sleep 5; continue; }

    shipit_count=$(echo "$new_comments" | jq \
      '[.[] | select(.body | test("^[[:space:]]*:shipit:[[:space:]]*$"))] | length' \
      2>/dev/null) || { sleep 5; continue; }

    if [[ "$shipit_count" -gt 0 ]]; then
      echo "approved"
      exit 0
    fi

    # Phase 1 — write fetched (crash-recovery checkpoint)
    comments_state=$(load_comments_state)
    comments_state=$(jq -n --argjson state "$comments_state" --argjson new "$new_comments" --arg latest "$latest_time" \
      '{pr_comments: (($state.pr_comments // []) + [$new[] | {id, user: .login, url, state: "fetched", emojis: []}]), last_comment_time: $latest}')
    save_comments_state "$comments_state"

    # Phase 2 — add reactions and update to processing
    new_ids=$(echo "$new_comments" | jq -r '.[].id')
    while IFS= read -r node_id; do
      [[ -n "$node_id" ]] || continue
      add_reaction "$node_id" EYES
    done <<< "$new_ids"
    comments_state=$(echo "$comments_state" | jq '.pr_comments |= map(if .state == "fetched" then (.state = "processing" | .emojis = [":eyes:"]) else . end)')
    save_comments_state "$comments_state"

    # Phase 3 — print output and exit
    echo "commented"
    echo "$new_comments" | jq -r '.[] | "---\nid: " + .id + "\nurl: " + .url + "\n" + .body'
    exit 0
  fi

  sleep 5
done
