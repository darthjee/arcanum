#!/usr/bin/env bash
# Start a clean branch for an issue from the latest main
# Usage: checkout_from_main.sh <id>
#
# Fetches origin/main (a missing remote tracking ref is not a hard error,
# but any other fetch failure is reported), checks out the local "main"
# branch, and hard-resets it to "origin/main" when that ref exists
# (otherwise main is used as-is). Then creates branch "issue-<id>" from
# main; if "issue-<id>" already exists locally it is deleted first, so the
# result is always a clean restart from the latest main — unlike
# auto-fix-issue/scripts/create_branch.sh, which reuses an existing branch
# instead of recreating it. Prints the resulting branch name to stdout.

set -euo pipefail

ID="${1:-}"

[[ -n "$ID" ]] || {
  echo "Usage: $0 <id>" >&2
  exit 1
}

if ! git fetch origin main 2>/tmp/checkout_from_main.fetch.$$; then
  fetch_err=$(cat /tmp/checkout_from_main.fetch.$$ 2>/dev/null || true)
  rm -f /tmp/checkout_from_main.fetch.$$
  if ! echo "$fetch_err" | grep -qiE "couldn't find remote ref|not found|no such ref"; then
    echo "Error: git fetch origin main failed: $fetch_err" >&2
    exit 1
  fi
else
  rm -f /tmp/checkout_from_main.fetch.$$
fi

git checkout main

if git show-ref --verify --quiet "refs/remotes/origin/main"; then
  git reset --hard origin/main
fi

BRANCH="issue-${ID}"

if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  git branch -D "$BRANCH"
fi

git checkout -b "$BRANCH" main

echo "$BRANCH"
