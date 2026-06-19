#!/usr/bin/env bash
# Wait for all CI check-runs on a PR's head commit to complete
# Usage: wait_ci.sh <pr_number>
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

set -euo pipefail

export GH_INSECURE_SKIP_VERIFY=true

PR_NUMBER="${1:-}"

[[ -n "$PR_NUMBER" ]] || {
  echo "Usage: $0 <pr_number>" >&2
  exit 1
}

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

_ensure_gh_user
REPO_REF=$(get_repo_ref)

while true; do
  sha=$(gh pr view "$PR_NUMBER" -R "$REPO_REF" --json headRefOid -q '.headRefOid' 2>/dev/null) || {
    sleep 5; continue
  }

  checks=$(gh api "repos/${REPO_REF}/commits/${sha}/check-runs?per_page=100" 2>/dev/null) || {
    sleep 5; continue
  }

  total=$(echo "$checks" | jq '.check_runs | length' 2>/dev/null) || { sleep 5; continue; }

  # No checks registered yet — keep waiting
  if [[ "$total" -eq 0 ]]; then
    sleep 5; continue
  fi

  failed=$(echo "$checks" | jq \
    '[.check_runs[] | select(.status == "completed" and (.conclusion == "failure" or .conclusion == "cancelled" or .conclusion == "timed_out"))] | length' \
    2>/dev/null) || { sleep 5; continue; }

  if [[ "$failed" -gt 0 ]]; then
    echo "failed"
    echo "$checks" | jq -r \
      '.check_runs[] | select(.status == "completed" and (.conclusion == "failure" or .conclusion == "cancelled" or .conclusion == "timed_out")) | .name'
    exit 0
  fi

  passed=$(echo "$checks" | jq \
    '[.check_runs[] | select(.status == "completed" and .conclusion == "success")] | length' \
    2>/dev/null) || { sleep 5; continue; }

  if [[ "$passed" -eq "$total" ]]; then
    echo "passed"
    exit 0
  fi

  # Still pending — keep waiting
  sleep 5
done
