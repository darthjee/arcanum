#!/usr/bin/env bash
# GitHub operations script for auto-fix-all
# Usage: github.sh <command> [args]
#   pr-number               Print the PR number (no '#') for the current branch
#   pr-state                Print STATE=<OPEN|MERGED|CLOSED> for the current branch's PR
#   pr-merge                Squash-merge the current branch's PR, print its URL
#   cleanup-branch <id>     Delete the issue's remote and local branch, switch back to main
#   has-shipit-label <id>   Exit 0 if GitHub issue <id> has a "shipit" label, else exit 1
#   add-tag <id> <tag>      Add a single tag to GitHub issue <id>, mapped to
#                           a real GitHub label via the canonical-tag/
#                           label-name table in `_lib/tags.sh`.
#   remove-tag <id> <tag>   Remove a single tag from GitHub issue <id>,
#                           mapped to a real GitHub label via the
#                           canonical-tag/label-name table in `_lib/tags.sh`.

set -euo pipefail

export GH_INSECURE_SKIP_VERIFY=true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../_lib/origin.sh
source "${SCRIPT_DIR}/../../_lib/origin.sh"
# shellcheck source=../../_lib/tags.sh
source "${SCRIPT_DIR}/../../_lib/tags.sh"
# shellcheck source=../../_lib/tag_mutate.sh
source "${SCRIPT_DIR}/../../_lib/tag_mutate.sh"

# --- Commands ---

cmd_pr_number() {
  # Try issue state cache first
  local branch
  branch=$(git branch --show-current)
  if [[ "$branch" =~ ^issue-([0-9]+)$ ]]; then
    local id="${BASH_REMATCH[1]}"
    local cached
    cached=$("${SCRIPT_DIR}/../../_lib/issue_state.sh" get "$id" pr_id 2>/dev/null || true)
    if [[ -n "$cached" ]]; then
      echo "$cached"
      return 0
    fi
  fi

  _ensure_gh_user
  local repo_ref
  repo_ref=$(get_repo_ref)

  local number
  number=$(gh pr view -R "$repo_ref" "$branch" --json number -q '.number' 2>/dev/null) || {
    echo "Error: no pull request found for the current branch on $repo_ref" >&2
    exit 1
  }

  [[ -n "$number" ]] || {
    echo "Error: no pull request found for the current branch on $repo_ref" >&2
    exit 1
  }

  echo "$number"
}

cmd_pr_state() {
  _ensure_gh_user
  local repo_ref branch
  repo_ref=$(get_repo_ref)
  branch=$(git branch --show-current)

  local state
  state=$(gh pr view -R "$repo_ref" "$branch" --json state -q '.state' 2>/dev/null) || {
    echo "Error: no pull request found for the current branch on $repo_ref" >&2
    exit 1
  }

  echo "STATE=$state"
}

cmd_pr_merge() {
  local branch
  branch=$(git branch --show-current)

  # Try issue state cache for pr_id and pr_url
  local cached_number="" cached_url=""
  if [[ "$branch" =~ ^issue-([0-9]+)$ ]]; then
    local id="${BASH_REMATCH[1]}"
    cached_number=$("${SCRIPT_DIR}/../../_lib/issue_state.sh" get "$id" pr_id 2>/dev/null || true)
    cached_url=$("${SCRIPT_DIR}/../../_lib/issue_state.sh" get "$id" pr_url 2>/dev/null || true)
  fi

  _ensure_gh_user
  local repo_ref
  repo_ref=$(get_repo_ref)

  local title number url
  if [[ -n "$cached_number" && -n "$cached_url" ]]; then
    number="$cached_number"
    url="$cached_url"
    title=$(gh pr view -R "$repo_ref" "$branch" --json title -q '.title' 2>/dev/null) || {
      echo "Error: no pull request found for the current branch on $repo_ref" >&2
      exit 1
    }
  else
    local output
    output=$(gh pr view -R "$repo_ref" "$branch" --json title,number,url 2>/dev/null) || {
      echo "Error: no pull request found for the current branch on $repo_ref" >&2
      exit 1
    }
    title=$(echo "$output" | jq -r '.title')
    number=$(echo "$output" | jq -r '.number')
    url=$(echo "$output" | jq -r '.url')
  fi

  gh pr merge "$number" -R "$repo_ref" --squash --delete-branch --subject "${title} (#${number})" --body "" >/dev/null || {
    echo "Error: could not merge PR #$number on $repo_ref" >&2
    exit 1
  }

  echo "$url"
}

cmd_cleanup_branch() {
  local id="${1:-}"
  [[ -n "$id" ]] || {
    echo "Usage: $0 cleanup-branch <id>" >&2
    exit 1
  }

  local branch="issue-${id}"

  # Delete remote branch — tolerate "not found" (may already be gone)
  git push origin --delete "$branch" 2>/dev/null || true

  # Switch back to main and reset to origin
  git checkout main
  git reset --hard origin/main

  # Delete local branch
  git branch -D "$branch"
}

cmd_has_shipit_label() {
  local id="${1:-}"
  [[ -n "$id" ]] || {
    echo "Usage: $0 has-shipit-label <id>" >&2
    exit 1
  }

  _ensure_gh_user
  local repo_ref
  repo_ref=$(get_repo_ref)

  local labels
  labels=$(gh issue view "$id" -R "$repo_ref" --json labels -q '.labels[].name' 2>/dev/null) || exit 1

  echo "$labels" | grep -qiE '^shipit$'
}

cmd_add_tag() {
  local id="${1:-}" tag="${2:-}"
  [[ -n "$id" && -n "$tag" ]] || {
    echo "Usage: $0 add-tag <id> <tag>" >&2
    exit 1
  }

  _ensure_gh_user
  local repo_ref
  repo_ref=$(get_repo_ref)

  tag_mutate_add_label "$id" "$repo_ref" "$tag" || exit 1
}

cmd_remove_tag() {
  local id="${1:-}" tag="${2:-}"
  [[ -n "$id" && -n "$tag" ]] || {
    echo "Usage: $0 remove-tag <id> <tag>" >&2
    exit 1
  }

  _ensure_gh_user
  local repo_ref
  repo_ref=$(get_repo_ref)

  tag_mutate_remove_label "$id" "$repo_ref" "$tag" || exit 1
}

case "${1:-}" in
  pr-number)         cmd_pr_number ;;
  pr-state)          cmd_pr_state ;;
  pr-merge)          cmd_pr_merge ;;
  cleanup-branch)    shift; cmd_cleanup_branch "$@" ;;
  has-shipit-label)  shift; cmd_has_shipit_label "$@" ;;
  add-tag)           shift; cmd_add_tag "$@" ;;
  remove-tag)        shift; cmd_remove_tag "$@" ;;
  *)
    echo "Usage: $0 <command> [args]" >&2
    echo "Commands:" >&2
    echo "  pr-number               Print the PR number (no '#') for the current branch" >&2
    echo "  pr-state                Print STATE=<OPEN|MERGED|CLOSED> for the current branch's PR" >&2
    echo "  pr-merge                Squash-merge the current branch's PR, print its URL" >&2
    echo "  cleanup-branch <id>     Delete the issue's remote and local branch, switch back to main" >&2
    echo "  has-shipit-label <id>   Exit 0 if GitHub issue <id> has a 'shipit' label, else exit 1" >&2
    echo "  add-tag <id> <tag>      Add a single tag to GitHub issue <id>, mapped to a real GitHub label via _lib/tags.sh" >&2
    echo "  remove-tag <id> <tag>   Remove a single tag from GitHub issue <id>, mapped to a real GitHub label via _lib/tags.sh" >&2
    exit 1
    ;;
esac
