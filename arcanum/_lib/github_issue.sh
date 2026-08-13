#!/usr/bin/env bash
# GitHub operations script for issue management
# Usage: github_issue.sh <command> [args]
#   info <repo_path>                            Print DOMAIN and REPO from git origin
#   fetch <repo_path> <id>                      Fetch a GitHub issue and save to docs/agents/issues/
#   update <repo_path> <id> <title> <file>      Update a GitHub issue title and body from a file
#   create <repo_path> <title> <file>           Create a new GitHub issue and save it to docs/agents/issues/
#   mark-created <repo_path> <id>               Add the Created label and remove Idea/Writting/Enhancing, if present
#   mark-refined <repo_path> <id>               Add the Refined label and remove Created, if present
#   mark-ready <repo_path> <id>                 Add the Ready label and remove Refined, if present
#   mark-enhancing <repo_path> <id>             Add the Enhancing label and remove Idea/Writting, if present
#   mark-planning <repo_path> <id>               Add the Planning label and remove Idea/Writting/Created, if present
#   mark-split <repo_path> <id>                  Add the Split label and remove Planning, if present

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=tags.sh
# Source the shared tag-parsing library
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/tags.sh"
# shellcheck source=tag_mutate.sh
# Source the shared tag-mutation library
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/tag_mutate.sh"
# shellcheck source=origin.sh
# Source the shared origin-resolution library
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/origin.sh"

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

# --- Commands ---

cmd_fetch() {
  local repo_path="${1:-}"
  local id="${2:-}"
  [[ -n "$repo_path" && -n "$id" ]] || { echo "Usage: $0 fetch <repo_path> <id>" >&2; exit 1; }

  _load_origin "$repo_path"

  local token
  token=$(get_github_token)

  local result
  result=$(curl -sf -H "Authorization: Bearer $token" \
    "https://api.github.com/repos/$_ORIGIN_REPO_PATH/issues/$id") || {
    echo "Error: could not fetch issue #$id from $_ORIGIN_REPO_PATH" >&2
    exit 1
  }

  local title body issue_state updated_at
  title=$(echo "$result" | jq -r '.title')
  body=$(echo "$result" | jq -r '.body')
  issue_state=$(echo "$result" | jq -r '.state')
  updated_at=$(echo "$result" | jq -r '.updated_at')

  local normalized
  normalized=$(normalize_title "$title")

  local issues_dir="docs/agents/issues"
  mkdir -p "$issues_dir"

  local filepath="${issues_dir}/${id}-${normalized}.md"
  printf '%s\n' "$body" > "$filepath"

  # Persist metadata to per-issue JSON state file
  local issue_state_script="${SCRIPT_DIR}/issue_state.sh"

  # Build tags JSON array from the issue's GitHub labels.
  # Uses jq to safely produce a valid JSON array; empty input yields [].
  local labels_text tags_json
  labels_text=$(echo "$result" | jq -r '.labels[].name')
  tags_json=$(extract_tags "$labels_text" | jq -R . | jq -s .)

  "$issue_state_script" set-json "$id" tags "$tags_json"
  "$issue_state_script" set      "$id" updated_at "$updated_at"
  "$issue_state_script" set      "$id" title "$title"
  "$issue_state_script" set      "$id" state "$issue_state"

  echo "TITLE=$title"
  echo "FILE=$filepath"
  echo "DOMAIN=$_ORIGIN_DOMAIN"
  echo "REPO=$_ORIGIN_REPO_PATH"
}

cmd_update() {
  local repo_path="${1:-}" id="${2:-}" title="${3:-}" file="${4:-}"
  [[ -n "$repo_path" && -n "$id" && -n "$title" && -n "$file" ]] || {
    echo "Usage: $0 update <repo_path> <id> <title> <file>" >&2; exit 1
  }
  [[ -f "$file" ]] || { echo "Error: file not found: $file" >&2; exit 1; }

  _load_origin "$repo_path"

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
  local repo_path="${1:-}" title="${2:-}" file="${3:-}"
  [[ -n "$repo_path" && -n "$title" && -n "$file" ]] || {
    echo "Usage: $0 create <repo_path> <title> <file>" >&2; exit 1
  }
  [[ -f "$file" ]] || { echo "Error: file not found: $file" >&2; exit 1; }

  _load_origin "$repo_path"

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
  local repo_path="${1:-}"
  [[ -n "$repo_path" ]] || { echo "Usage: $0 info <repo_path>" >&2; exit 1; }

  _load_origin "$repo_path"
  echo "DOMAIN=$_ORIGIN_DOMAIN"
  echo "REPO=$_ORIGIN_REPO_PATH"
}

cmd_mark_refined() {
  local repo_path="${1:-}"
  local id="${2:-}"
  [[ -n "$repo_path" && -n "$id" ]] || { echo "Usage: $0 mark-refined <repo_path> <id>" >&2; exit 1; }

  _load_origin "$repo_path"
  local repo_ref="$_ORIGIN_REPO_PATH"

  tag_mutate_add_label "$id" "$repo_ref" refined \
    || echo "Warning: could not add 'refined' tag to issue #$id on $repo_ref" >&2
  tag_mutate_remove_label "$id" "$repo_ref" created \
    || echo "Warning: could not remove 'created' tag from issue #$id on $repo_ref" >&2
  tag_mutate_remove_label "$id" "$repo_ref" idea \
    || echo "Warning: could not remove 'idea' tag from issue #$id on $repo_ref" >&2
  tag_mutate_remove_label "$id" "$repo_ref" writting \
    || echo "Warning: could not remove 'writting' tag from issue #$id on $repo_ref" >&2

  return 0
}

cmd_mark_created() {
  local repo_path="${1:-}"
  local id="${2:-}"
  [[ -n "$repo_path" && -n "$id" ]] || { echo "Usage: $0 mark-created <repo_path> <id>" >&2; exit 1; }

  _load_origin "$repo_path"
  local repo_ref="$_ORIGIN_REPO_PATH"

  tag_mutate_add_label "$id" "$repo_ref" created \
    || echo "Warning: could not add 'created' tag to issue #$id on $repo_ref" >&2
  tag_mutate_remove_label "$id" "$repo_ref" idea \
    || echo "Warning: could not remove 'idea' tag from issue #$id on $repo_ref" >&2
  tag_mutate_remove_label "$id" "$repo_ref" writting \
    || echo "Warning: could not remove 'writting' tag from issue #$id on $repo_ref" >&2
  tag_mutate_remove_label "$id" "$repo_ref" enhancing \
    || echo "Warning: could not remove 'enhancing' tag from issue #$id on $repo_ref" >&2

  return 0
}

cmd_mark_enhancing() {
  local repo_path="${1:-}"
  local id="${2:-}"
  [[ -n "$repo_path" && -n "$id" ]] || { echo "Usage: $0 mark-enhancing <repo_path> <id>" >&2; exit 1; }

  _load_origin "$repo_path"
  local repo_ref="$_ORIGIN_REPO_PATH"

  tag_mutate_add_label "$id" "$repo_ref" enhancing \
    || echo "Warning: could not add 'enhancing' tag to issue #$id on $repo_ref" >&2
  tag_mutate_remove_label "$id" "$repo_ref" idea \
    || echo "Warning: could not remove 'idea' tag from issue #$id on $repo_ref" >&2
  tag_mutate_remove_label "$id" "$repo_ref" writting \
    || echo "Warning: could not remove 'writting' tag from issue #$id on $repo_ref" >&2

  return 0
}

cmd_mark_planning() {
  local repo_path="${1:-}"
  local id="${2:-}"
  [[ -n "$repo_path" && -n "$id" ]] || { echo "Usage: $0 mark-planning <repo_path> <id>" >&2; exit 1; }

  _load_origin "$repo_path"
  local repo_ref="$_ORIGIN_REPO_PATH"

  tag_mutate_add_label "$id" "$repo_ref" planning \
    || echo "Warning: could not add 'planning' tag to issue #$id on $repo_ref" >&2
  tag_mutate_remove_label "$id" "$repo_ref" idea \
    || echo "Warning: could not remove 'idea' tag from issue #$id on $repo_ref" >&2
  tag_mutate_remove_label "$id" "$repo_ref" writting \
    || echo "Warning: could not remove 'writting' tag from issue #$id on $repo_ref" >&2
  tag_mutate_remove_label "$id" "$repo_ref" created \
    || echo "Warning: could not remove 'created' tag from issue #$id on $repo_ref" >&2

  return 0
}

cmd_mark_split() {
  local repo_path="${1:-}"
  local id="${2:-}"
  [[ -n "$repo_path" && -n "$id" ]] || { echo "Usage: $0 mark-split <repo_path> <id>" >&2; exit 1; }

  _load_origin "$repo_path"
  local repo_ref="$_ORIGIN_REPO_PATH"

  tag_mutate_add_label "$id" "$repo_ref" split \
    || echo "Warning: could not add 'split' tag to issue #$id on $repo_ref" >&2
  tag_mutate_remove_label "$id" "$repo_ref" planning \
    || echo "Warning: could not remove 'planning' tag from issue #$id on $repo_ref" >&2

  return 0
}

cmd_mark_ready() {
  local repo_path="${1:-}"
  local id="${2:-}"
  [[ -n "$repo_path" && -n "$id" ]] || { echo "Usage: $0 mark-ready <repo_path> <id>" >&2; exit 1; }

  _load_origin "$repo_path"
  local repo_ref="$_ORIGIN_REPO_PATH"

  tag_mutate_add_label "$id" "$repo_ref" ready \
    || echo "Warning: could not add 'ready' tag to issue #$id on $repo_ref" >&2
  tag_mutate_remove_label "$id" "$repo_ref" refined \
    || echo "Warning: could not remove 'refined' tag from issue #$id on $repo_ref" >&2

  return 0
}

case "${1:-}" in
  info)            shift; cmd_info "$@" ;;
  fetch)           shift; cmd_fetch  "$@" ;;
  update)          shift; cmd_update "$@" ;;
  create)          shift; cmd_create "$@" ;;
  mark-created)    shift; cmd_mark_created "$@" ;;
  mark-refined)    shift; cmd_mark_refined "$@" ;;
  mark-ready)      shift; cmd_mark_ready "$@" ;;
  mark-enhancing)  shift; cmd_mark_enhancing "$@" ;;
  mark-planning)   shift; cmd_mark_planning "$@" ;;
  mark-split)      shift; cmd_mark_split "$@" ;;
  *)
    echo "Usage: $0 <command> [args]" >&2
    echo "Commands:" >&2
    echo "  info <repo_path>                            Print DOMAIN and REPO from git origin" >&2
    echo "  fetch <repo_path> <id>                      Fetch a GitHub issue and save to docs/agents/issues/" >&2
    echo "  update <repo_path> <id> <title> <file>      Update a GitHub issue title and body from a file" >&2
    echo "  create <repo_path> <title> <file>           Create a new GitHub issue and save it to docs/agents/issues/" >&2
    echo "  mark-created <repo_path> <id>               Add the Created label and remove Idea/Writting/Enhancing, if present" >&2
    echo "  mark-refined <repo_path> <id>               Add the Refined label and remove Created, if present" >&2
    echo "  mark-ready <repo_path> <id>                 Add the Ready label and remove Refined, if present" >&2
    echo "  mark-enhancing <repo_path> <id>             Add the Enhancing label and remove Idea/Writting, if present" >&2
    echo "  mark-planning <repo_path> <id>               Add the Planning label and remove Idea/Writting/Created, if present" >&2
    echo "  mark-split <repo_path> <id>                  Add the Split label and remove Planning, if present" >&2
    exit 1
    ;;
esac
