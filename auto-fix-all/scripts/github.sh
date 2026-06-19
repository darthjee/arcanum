#!/usr/bin/env bash
# GitHub operations script for auto-fix-all
# Usage: github.sh <command> [args]
#   pr-number               Print the PR number (no '#') for the current branch
#   pr-state                Print STATE=<OPEN|MERGED|CLOSED> for the current branch's PR
#   pr-merge                Squash-merge the current branch's PR, print its URL
#   has-shipit-label <id>   Exit 0 if GitHub issue <id> has a "shipit" label, else exit 1

set -euo pipefail

export GH_INSECURE_SKIP_VERIFY=true

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_lib_origin.sh"

# --- Commands ---

cmd_pr_number() {
  _ensure_gh_user
  local repo_ref branch
  repo_ref=$(get_repo_ref)
  branch=$(git branch --show-current)

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
  _ensure_gh_user
  local repo_ref branch
  repo_ref=$(get_repo_ref)
  branch=$(git branch --show-current)

  local output
  output=$(gh pr view -R "$repo_ref" "$branch" --json title,number,url 2>/dev/null) || {
    echo "Error: no pull request found for the current branch on $repo_ref" >&2
    exit 1
  }

  local title number url
  title=$(echo "$output" | jq -r '.title')
  number=$(echo "$output" | jq -r '.number')
  url=$(echo "$output" | jq -r '.url')

  gh pr merge "$number" -R "$repo_ref" --squash --subject "${title} (#${number})" --body "" >/dev/null || {
    echo "Error: could not merge PR #$number on $repo_ref" >&2
    exit 1
  }

  echo "$url"
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

case "${1:-}" in
  pr-number)         cmd_pr_number ;;
  pr-state)          cmd_pr_state ;;
  pr-merge)          cmd_pr_merge ;;
  has-shipit-label)  shift; cmd_has_shipit_label "$@" ;;
  *)
    echo "Usage: $0 <command> [args]" >&2
    echo "Commands:" >&2
    echo "  pr-number               Print the PR number (no '#') for the current branch" >&2
    echo "  pr-state                Print STATE=<OPEN|MERGED|CLOSED> for the current branch's PR" >&2
    echo "  pr-merge                Squash-merge the current branch's PR, print its URL" >&2
    echo "  has-shipit-label <id>   Exit 0 if GitHub issue <id> has a 'shipit' label, else exit 1" >&2
    exit 1
    ;;
esac
