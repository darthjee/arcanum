#!/usr/bin/env bash
# GitHub operations script
# Usage: github.sh <command> [args]
#   info                         Print DOMAIN and REPO from git origin
#   fetch <id>                   Fetch a GitHub issue and save to docs/agents/issues/
#   update <id> <title> <file>   Update a GitHub issue title and body from a file

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

# --- Utilities ---

normalize_title() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9]/-/g' \
    | sed 's/-\+/-/g' \
    | sed 's/^-//' \
    | sed 's/-$//'
}

# --- Commands ---

cmd_fetch() {
  local id="${1:-}"
  [[ -n "$id" ]] || { echo "Usage: $0 fetch <id>" >&2; exit 1; }

  _load_origin

  local repo_ref
  repo_ref=$(get_repo_ref)

  local result
  result=$(gh issue view "$id" -R "$repo_ref" --json title,body 2>/dev/null) || {
    echo "Error: could not fetch issue #$id from $repo_ref" >&2
    exit 1
  }

  local title body
  title=$(echo "$result" | jq -r '.title')
  body=$(echo "$result" | jq -r '.body')

  local normalized
  normalized=$(normalize_title "$title")

  local issues_dir="docs/agents/issues"
  mkdir -p "$issues_dir"

  local filepath="${issues_dir}/${id}-${normalized}.md"
  printf '%s\n' "$body" > "$filepath"

  echo "TITLE=$title"
  echo "FILE=$filepath"
  echo "DOMAIN=$_ORIGIN_DOMAIN"
  echo "REPO=$_ORIGIN_REPO_PATH"
}

cmd_update() {
  local id="${1:-}" title="${2:-}" file="${3:-}"
  [[ -n "$id" && -n "$title" && -n "$file" ]] || {
    echo "Usage: $0 update <id> <title> <file>" >&2; exit 1
  }
  [[ -f "$file" ]] || { echo "Error: file not found: $file" >&2; exit 1; }

  _load_origin

  local repo_ref
  repo_ref=$(get_repo_ref)

  gh issue edit "$id" -R "$repo_ref" --title "$title" --body-file "$file" || {
    echo "Error: could not update issue #$id on $repo_ref" >&2
    exit 1
  }

  echo "Updated issue #$id on $repo_ref"
}

cmd_info() {
  _load_origin
  echo "DOMAIN=$_ORIGIN_DOMAIN"
  echo "REPO=$_ORIGIN_REPO_PATH"
}

case "${1:-}" in
  info)   cmd_info ;;
  fetch)  shift; cmd_fetch  "$@" ;;
  update) shift; cmd_update "$@" ;;
  *)
    echo "Usage: $0 <command> [args]" >&2
    echo "Commands:" >&2
    echo "  info                         Print DOMAIN and REPO from git origin" >&2
    echo "  fetch <id>                   Fetch a GitHub issue and save to docs/agents/issues/" >&2
    echo "  update <id> <title> <file>   Update a GitHub issue title and body from a file" >&2
    exit 1
    ;;
esac
