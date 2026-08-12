#!/usr/bin/env bash
# Resolve the PR number for an issue's branch
# Usage: resolve_pr_number.sh <repo_path> <id>
#
# <id> must be the numeric GitHub issue id (used only for validation/usage
# clarity); the actual lookup is driven by the current branch, which the
# caller is expected to have already checked out as "issue-<id>". Prints
# the PR number (no '#') for that branch on the configured origin repo.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/origin.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/origin.sh"
# shellcheck source=../../arcanum/_lib/repo_path.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/repo_path.sh"

REPO_PATH="${1:?Usage: $0 <repo_path> <id>}"
ID="${2:-}"
ID="${ID#\#}"

[[ "$ID" =~ ^[0-9]+$ ]] || {
  echo "Usage: $0 <repo_path> <id>" >&2
  exit 1
}

repo_path_enter "$REPO_PATH"

# Try the local issue state first (avoids an extra GitHub API call)
SCRIPT_DIR_SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cached_number=$("${SCRIPT_DIR_SELF}/../../arcanum/_lib/issue_state.sh" get "$ID" pr_id 2>/dev/null || true)
if [[ -n "$cached_number" ]]; then
  echo "$cached_number"
  exit 0
fi

_ensure_gh_user
repo_ref=$(get_repo_ref "$REPO_PATH")
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
