#!/usr/bin/env bash
# Bootstrap or reuse the branch for an issue, merged up to date with main
# Usage: checkout_from_main.sh <id>
#
# Fetches "origin/main" and "origin/issue-<id>" (a missing remote ref for
# either is not a hard error; any other fetch failure is reported).
#
# If "issue-<id>" already exists — locally or as "origin/issue-<id>" —
# it is checked out (creating a local branch tracking the remote one
# first, if it only exists remotely) and merged up to date with
# "origin/main" (a no-op when there's no "origin/main" ref yet). This
# reuses and merges an existing branch instead of destroying it — unlike
# the previous behavior, which always deleted and recreated "issue-<id>"
# from "main".
#
# If "issue-<id>" doesn't exist at all (neither local nor remote), it is
# created fresh from "origin/main" (falling back to local "main" when
# there's no "origin/main" ref) — no merge is needed in this case.
#
# Prints "BRANCH=<name>" then "STATUS=ok" or "STATUS=conflict" (with the
# conflicted-file list, one path per line, printed after the STATUS line
# when there's a conflict). Exits 0 on "ok", 2 on "conflict".

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../_lib/git_branch.sh
source "${SCRIPT_DIR}/../../_lib/git_branch.sh"

ID="${1:-}"

[[ -n "$ID" ]] || {
  echo "Usage: $0 <id>" >&2
  exit 1
}

BRANCH="issue-${ID}"

git_branch_fetch_main

if ! git fetch origin "${BRANCH}" 2>"/tmp/checkout_from_main.fetch_branch.$$"; then
  fetch_err=$(cat "/tmp/checkout_from_main.fetch_branch.$$" 2>/dev/null || true)
  rm -f "/tmp/checkout_from_main.fetch_branch.$$"
  if ! echo "$fetch_err" | grep -qiE "couldn't find remote ref|not found|no such ref"; then
    echo "Error: git fetch origin ${BRANCH} failed: $fetch_err" >&2
    exit 1
  fi
else
  rm -f "/tmp/checkout_from_main.fetch_branch.$$"
fi

STATUS="ok"
CONFLICTS=""

if git show-ref --verify --quiet "refs/heads/${BRANCH}" || git show-ref --verify --quiet "refs/remotes/origin/${BRANCH}"; then
  if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
    git checkout "${BRANCH}"
  else
    git checkout -b "${BRANCH}" "origin/${BRANCH}"
  fi

  if CONFLICTS=$(git_branch_merge_main); then
    STATUS="ok"
  else
    STATUS="conflict"
  fi
else
  if git show-ref --verify --quiet "refs/remotes/origin/main"; then
    git checkout -b "${BRANCH}" origin/main
  else
    git checkout -b "${BRANCH}" main
  fi
fi

echo "BRANCH=${BRANCH}"
echo "STATUS=${STATUS}"
if [[ "$STATUS" == "conflict" ]]; then
  echo "$CONFLICTS"
fi

if [[ "$STATUS" == "conflict" ]]; then
  exit 2
fi
exit 0
