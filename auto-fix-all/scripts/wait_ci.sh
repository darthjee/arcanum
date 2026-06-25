#!/usr/bin/env bash
# Wait for all CI check-runs on a PR's head commit to complete
# Usage: wait_ci.sh
#
# Blocking loop (5s sleep) that polls the GitHub Checks API for ALL
# check-runs on the PR's head commit, from any CI provider (no filtering
# by app slug, unlike majora's CircleCI-only cmd_wait_ci). Transient gh/api
# errors are retried silently. If zero check-runs are registered yet, keeps
# waiting instead of falsely reporting "passed".
#
# Output: first line is "passed" or "failed". On "failed", subsequent
# lines are the names of the failed check-runs (status completed and
# conclusion in failure/cancelled/timed_out).
#
# Check-runs whose name case-insensitively contains any pattern in the
# project's configured ignored_check_patterns are excluded entirely from
# the passed/failed/total accounting (neither blocking the PR nor required
# to pass). Patterns are read from the target project's own
# .claude/configuration/auto-fix-all.json (relative to the current working
# directory), field "ignored_check_patterns" (an array of regex strings).
# If the file or field is missing, no patterns are ignored. This exists
# because some check-runs (e.g. Codacy) can report a "action_required"
# conclusion that is neither success nor a failure state, which would
# otherwise hang this script forever unless ignored.

set -euo pipefail

export GH_INSECURE_SKIP_VERIFY=true

CONFIG_FILE=".claude/configuration/auto-fix-all.json"

if [[ -f "$CONFIG_FILE" ]]; then
  ignored_json=$(jq -c '.ignored_check_patterns // []' "$CONFIG_FILE")
else
  ignored_json="[]"
fi

# shellcheck source=../../_lib/origin.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../../_lib/origin.sh"

_ensure_gh_user
REPO_REF=$(get_repo_ref)

branch=$(git branch --show-current)
PR_NUMBER=$(gh pr view -R "$REPO_REF" "$branch" --json number -q '.number' 2>/dev/null) || {
  echo "Error: no pull request found for the current branch on $REPO_REF" >&2
  exit 1
}
[[ -n "$PR_NUMBER" ]] || {
  echo "Error: no pull request found for the current branch on $REPO_REF" >&2
  exit 1
}

while true; do
  sha=$(gh pr view "$PR_NUMBER" -R "$REPO_REF" --json headRefOid -q '.headRefOid' 2>/dev/null) || {
    sleep 5; continue
  }

  checks=$(gh api "repos/${REPO_REF}/commits/${sha}/check-runs?per_page=100" 2>/dev/null) || {
    sleep 5; continue
  }

  filtered=$(echo "$checks" | jq --argjson ignored "$ignored_json" \
    '.check_runs |= map(select(([$ignored[] as $p | (.name | test($p; "i"))] | any) | not))' \
    2>/dev/null) || { sleep 5; continue; }

  total=$(echo "$filtered" | jq '.check_runs | length' 2>/dev/null) || { sleep 5; continue; }

  # No checks registered yet — keep waiting
  if [[ "$total" -eq 0 ]]; then
    sleep 5; continue
  fi

  failed=$(echo "$filtered" | jq \
    '[.check_runs[] | select(.status == "completed" and (.conclusion == "failure" or .conclusion == "cancelled" or .conclusion == "timed_out"))] | length' \
    2>/dev/null) || { sleep 5; continue; }

  if [[ "$failed" -gt 0 ]]; then
    echo "failed"
    echo "$filtered" | jq -r \
      '.check_runs[] | select(.status == "completed" and (.conclusion == "failure" or .conclusion == "cancelled" or .conclusion == "timed_out")) | .name'
    exit 0
  fi

  passed=$(echo "$filtered" | jq \
    '[.check_runs[] | select(.status == "completed" and .conclusion == "success")] | length' \
    2>/dev/null) || { sleep 5; continue; }

  if [[ "$passed" -eq "$total" ]]; then
    echo "passed"
    exit 0
  fi

  # Still pending — keep waiting
  sleep 5
done
