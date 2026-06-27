#!/usr/bin/env bash
# GitHub operations script
# Usage: github.sh <command> [args]
#   info                        Print DOMAIN and REPO from git origin
#   pr-create <title> <file>    Create a pull request with title and body from a file
#   pr-view                     Print URL and IS_DRAFT for the current branch's PR
#   pr-ready                    Mark the current branch's PR as ready for review

set -euo pipefail

export GH_INSECURE_SKIP_VERIFY=true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Origin helpers (cached) ---

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

get_domain() {
  _load_origin
  echo "$_ORIGIN_DOMAIN"
}

get_repo_path() {
  _load_origin
  echo "$_ORIGIN_REPO_PATH"
}

# Returns [HOST/]OWNER/REPO as expected by gh -R flag
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

# --- PR state persistence ---

_persist_pr_state() {
  local url="$1"
  local branch
  branch=$(git branch --show-current)
  if [[ "$branch" =~ ^issue-([0-9]+)$ ]]; then
    local id="${BASH_REMATCH[1]}"
    local number="${url##*/}"
    "${SCRIPT_DIR}/issue_state.sh" set "$id" pr_url "$url" 2>/dev/null || true
    "${SCRIPT_DIR}/issue_state.sh" set "$id" pr_id  "$number" 2>/dev/null || true
  fi
}

# --- Commands ---

cmd_info() {
  _load_origin
  echo "DOMAIN=$_ORIGIN_DOMAIN"
  echo "REPO=$_ORIGIN_REPO_PATH"
}

cmd_pr_create() {
  local title="${1:-}" file="${2:-}"
  [[ -n "$title" && -n "$file" ]] || {
    echo "Usage: $0 pr-create <title> <file>" >&2; exit 1
  }
  [[ -f "$file" ]] || { echo "Error: file not found: $file" >&2; exit 1; }

  _ensure_gh_user
  _load_origin

  local repo_ref
  repo_ref=$(get_repo_ref)

  local url
  url=$(gh pr create -R "$repo_ref" --title "$title" --body-file "$file") || {
    echo "Error: could not create PR on $repo_ref" >&2
    exit 1
  }

  _persist_pr_state "$url"
  echo "$url"
}

cmd_pr_view() {
  _ensure_gh_user
  _load_origin

  local repo_ref branch
  repo_ref=$(get_repo_ref)
  branch=$(git branch --show-current)

  local output
  if output=$(gh pr view -R "$repo_ref" "$branch" --json url,isDraft 2>&1); then
    local url is_draft
    url=$(echo "$output" | jq -r '.url')
    is_draft=$(echo "$output" | jq -r '.isDraft')
    _persist_pr_state "$url"
    echo "URL=$url"
    echo "IS_DRAFT=$is_draft"
  else
    if echo "$output" | grep -qi "no pull requests found"; then
      exit 1
    fi
    echo "Error: could not view PR on $repo_ref: $output" >&2
    exit 1
  fi
}

cmd_pr_ready() {
  _ensure_gh_user
  _load_origin

  local repo_ref branch
  repo_ref=$(get_repo_ref)
  branch=$(git branch --show-current)

  gh pr ready -R "$repo_ref" "$branch" >/dev/null || {
    echo "Error: could not mark PR ready on $repo_ref" >&2
    exit 1
  }

  local url
  url=$(gh pr view -R "$repo_ref" "$branch" --json url -q '.url' 2>/dev/null) || true
  if [[ -n "$url" ]]; then
    _persist_pr_state "$url"
  fi

  echo "OK"
}

case "${1:-}" in
  info)      cmd_info ;;
  pr-create) shift; cmd_pr_create "$@" ;;
  pr-view)   cmd_pr_view ;;
  pr-ready)  cmd_pr_ready ;;
  *)
    echo "Usage: $0 <command> [args]" >&2
    echo "Commands:" >&2
    echo "  info                        Print DOMAIN and REPO from git origin" >&2
    echo "  pr-create <title> <file>    Create a pull request with title and body from a file" >&2
    echo "  pr-view                     Print URL and IS_DRAFT for the current branch's PR" >&2
    echo "  pr-ready                    Mark the current branch's PR as ready for review" >&2
    exit 1
    ;;
esac
