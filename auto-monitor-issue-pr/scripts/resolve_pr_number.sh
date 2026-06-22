#!/usr/bin/env bash
# Resolve the PR number for an issue's branch
# Usage: resolve_pr_number.sh <id>
#
# <id> must be the numeric GitHub issue id (used only for validation/usage
# clarity); the actual lookup is driven by the current branch, which the
# caller is expected to have already checked out as "issue-<id>". Prints
# the PR number (no '#') for that branch on the configured origin repo.

set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_lib_origin.sh"

ID="${1:-}"
ID="${ID#\#}"

[[ "$ID" =~ ^[0-9]+$ ]] || {
  echo "Usage: $0 <id>" >&2
  exit 1
}

_ensure_gh_user
repo_ref=$(get_repo_ref)
branch=$(git branch --show-current)

number=$(gh pr view -R "$repo_ref" "$branch" --json number -q '.number' 2>/dev/null) || {
  echo "Error: no pull request found for the current branch on $repo_ref" >&2
  exit 1
}

[[ -n "$number" ]] || {
  echo "Error: no pull request found for the current branch on $repo_ref" >&2
  exit 1
}

echo "$number"
