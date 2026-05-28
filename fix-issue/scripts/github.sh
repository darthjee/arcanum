#!/usr/bin/env bash
# GitHub operations script
# Usage: github.sh <command> [args]
#   info                        Print DOMAIN and REPO from git origin
#   pr-create <title> <file>    Create a pull request with title and body from a file

set -euo pipefail

export GH_INSECURE_SKIP_VERIFY=true

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

  _load_origin

  local repo_ref
  repo_ref=$(get_repo_ref)

  local url
  url=$(gh pr create -R "$repo_ref" --title "$title" --body-file "$file") || {
    echo "Error: could not create PR on $repo_ref" >&2
    exit 1
  }

  echo "$url"
}

case "${1:-}" in
  info)      cmd_info ;;
  pr-create) shift; cmd_pr_create "$@" ;;
  *)
    echo "Usage: $0 <command> [args]" >&2
    echo "Commands:" >&2
    echo "  info                        Print DOMAIN and REPO from git origin" >&2
    echo "  pr-create <title> <file>    Create a pull request with title and body from a file" >&2
    exit 1
    ;;
esac
