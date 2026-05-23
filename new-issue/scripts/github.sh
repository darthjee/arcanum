#!/usr/bin/env bash
# GitHub operations for the new-issue skill
# Usage: github.sh <command> [args]
#   fetch <id>   Fetch a GitHub issue and save to docs/agents/issues/

set -euo pipefail

parse_origin() {
  local origin
  origin=$(git remote get-url origin 2>/dev/null) || {
    echo "Error: not a git repository or no 'origin' remote" >&2
    exit 1
  }

  local domain repo_path

  if [[ "$origin" =~ ^git@ ]]; then
    domain="${origin#git@}"
    domain="${domain%%:*}"
    repo_path="${origin#*:}"
    repo_path="${repo_path%.git}"
  elif [[ "$origin" =~ ^https?:// ]]; then
    local stripped="${origin#*://}"
    domain="${stripped%%/*}"
    repo_path="${stripped#*/}"
    repo_path="${repo_path%.git}"
  else
    echo "Error: unrecognized origin format: $origin" >&2
    exit 1
  fi

  echo "$domain $repo_path"
}

normalize_title() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9]/-/g' \
    | sed 's/-\+/-/g' \
    | sed 's/^-//' \
    | sed 's/-$//'
}

cmd_fetch() {
  local id="${1:-}"
  [[ -n "$id" ]] || { echo "Usage: $0 fetch <id>" >&2; exit 1; }

  local origin_info domain repo_path
  origin_info=$(parse_origin)
  domain=$(echo "$origin_info" | awk '{print $1}')
  repo_path=$(echo "$origin_info" | awk '{print $2}')

  local repo_ref
  if [[ "$domain" == "github.com" ]]; then
    repo_ref="$repo_path"
  else
    repo_ref="$domain/$repo_path"
  fi

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
  echo "DOMAIN=$domain"
  echo "REPO=$repo_path"
}

case "${1:-}" in
  fetch) shift; cmd_fetch "$@" ;;
  *)
    echo "Usage: $0 <command> [args]" >&2
    echo "Commands:" >&2
    echo "  fetch <id>   Fetch a GitHub issue and save to docs/agents/issues/" >&2
    exit 1
    ;;
esac
