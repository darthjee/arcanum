#!/usr/bin/env bash
# GitHub operations script
# Usage: github.sh <command> [args]
#   info                            Print DOMAIN and REPO from git origin
#   fetch <id>                      Fetch a GitHub issue and save to docs/agents/issues/
#   update <id> <title> <file>      Update a GitHub issue title and body from a file
#   create <title> <file>           Create a new GitHub issue and save it to docs/agents/issues/

set -euo pipefail

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

get_github_token() {
  _ensure_gh_user
  gh auth token 2>/dev/null || gh auth token --hostname github.com 2>/dev/null || {
    echo "Error: could not obtain GitHub token via gh auth token" >&2
    exit 1
  }
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

extract_tags_block() {
  local body="$1"
  local tags_block
  tags_block=$(perl -0777 -ne 'if (/(?:[ \t]*\n)+---[ \t]*(?:[ \t]*\n)+((?:(?i)tags:.*\n?)+)$/) { print $1 }' <<< "$body")
  printf '%s' "$tags_block" | sed -e 's/[[:space:]]*$//'
}

strip_tags_block() {
  local body="$1"
  perl -0777 -pe 's/(?:[ \t]*\n)+---[ \t]*(?:[ \t]*\n)+(?:(?i)tags:.*\n?)+$//' <<< "$body"
}

# --- Commands ---

cmd_fetch() {
  local id="${1:-}"
  [[ -n "$id" ]] || { echo "Usage: $0 fetch <id>" >&2; exit 1; }

  _load_origin

  local token
  token=$(get_github_token)

  local result
  result=$(curl -sf -H "Authorization: Bearer $token" \
    "https://api.github.com/repos/$_ORIGIN_REPO_PATH/issues/$id") || {
    echo "Error: could not fetch issue #$id from $_ORIGIN_REPO_PATH" >&2
    exit 1
  }

  local title body
  title=$(echo "$result" | jq -r '.title')
  body=$(echo "$result" | jq -r '.body')

  local tags_block
  tags_block=$(extract_tags_block "$body")

  if [[ -n "$tags_block" ]]; then
    body=$(strip_tags_block "$body")
  fi

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

  if [[ -n "$tags_block" ]]; then
    echo "TAGS_BEGIN"
    printf '%s\n' "$tags_block"
    echo "TAGS_END"
  fi
}

cmd_update() {
  local id="${1:-}" title="${2:-}" file="${3:-}"
  [[ -n "$id" && -n "$title" && -n "$file" ]] || {
    echo "Usage: $0 update <id> <title> <file>" >&2; exit 1
  }
  [[ -f "$file" ]] || { echo "Error: file not found: $file" >&2; exit 1; }

  _load_origin

  local token
  token=$(get_github_token)

  local body
  body=$(cat "$file")

  local payload
  payload=$(jq -n --arg title "$title" --arg body "$body" \
    '{"title": $title, "body": $body}')

  curl -sf -X PATCH \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "https://api.github.com/repos/$_ORIGIN_REPO_PATH/issues/$id" > /dev/null || {
    echo "Error: could not update issue #$id on $_ORIGIN_REPO_PATH" >&2
    exit 1
  }

  echo "Updated issue #$id on $_ORIGIN_REPO_PATH"
}

cmd_create() {
  local title="${1:-}" file="${2:-}"
  [[ -n "$title" && -n "$file" ]] || {
    echo "Usage: $0 create <title> <file>" >&2; exit 1
  }
  [[ -f "$file" ]] || { echo "Error: file not found: $file" >&2; exit 1; }

  _load_origin

  local token
  token=$(get_github_token)

  local body
  body=$(cat "$file")

  local payload
  payload=$(jq -n --arg title "$title" --arg body "$body" \
    '{"title": $title, "body": $body}')

  local result
  result=$(curl -sf -X POST \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "https://api.github.com/repos/$_ORIGIN_REPO_PATH/issues") || {
    echo "Error: could not create issue on $_ORIGIN_REPO_PATH" >&2
    exit 1
  }

  local id normalized issues_dir filepath
  id=$(echo "$result" | jq -r '.number')
  normalized=$(normalize_title "$title")
  issues_dir="docs/agents/issues"
  mkdir -p "$issues_dir"
  filepath="${issues_dir}/${id}-${normalized}.md"
  printf '%s\n' "$body" > "$filepath"

  echo "ID=$id"
  echo "TITLE=$title"
  echo "FILE=$filepath"
  echo "DOMAIN=$_ORIGIN_DOMAIN"
  echo "REPO=$_ORIGIN_REPO_PATH"
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
  create) shift; cmd_create "$@" ;;
  *)
    echo "Usage: $0 <command> [args]" >&2
    echo "Commands:" >&2
    echo "  info                            Print DOMAIN and REPO from git origin" >&2
    echo "  fetch <id>                      Fetch a GitHub issue and save to docs/agents/issues/" >&2
    echo "  update <id> <title> <file>      Update a GitHub issue title and body from a file" >&2
    echo "  create <title> <file>           Create a new GitHub issue and save it to docs/agents/issues/" >&2
    exit 1
    ;;
esac
