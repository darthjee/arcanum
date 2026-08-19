#!/usr/bin/env bash
# GitHub operations script
# Usage: github.sh <command> <repo_path> [args]
#   info <repo_path>                        Print DOMAIN and REPO from git origin
#   pr-create <repo_path> <title> <file>    Create a pull request with title and body from a file
#   pr-view <repo_path>                     Print URL and IS_DRAFT for the current branch's PR
#   pr-ready <repo_path>                    Mark the current branch's PR as ready for review

set -euo pipefail

export GH_INSECURE_SKIP_VERIFY=true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/tags.sh
# Source the shared tag-parsing library
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../../arcanum/_lib/tags.sh"
# shellcheck source=../../arcanum/_lib/tag_mutate.sh
# Source the shared tag-mutation library
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../../arcanum/_lib/tag_mutate.sh"
# shellcheck source=../../arcanum/_lib/origin.sh
# Source the shared origin-resolution library
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../../arcanum/_lib/origin.sh"
# shellcheck source=../../arcanum/_lib/repo_path.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../../arcanum/_lib/repo_path.sh"

# --- PR state persistence ---

# _current_issue_id
#   Echoes the numeric issue id if the current branch matches
#   `issue-<id>`, or nothing otherwise.
_current_issue_id() {
  local branch
  branch=$(git branch --show-current)
  if [[ "$branch" =~ ^issue-([0-9]+)$ ]]; then
    echo "${BASH_REMATCH[1]}"
  fi
}

_persist_pr_state() {
  local repo_path="$1"
  local url="$2"
  local id
  id=$(_current_issue_id)
  if [[ -n "$id" ]]; then
    local number="${url##*/}"
    "${SCRIPT_DIR}/issue_state.sh" "$repo_path" set "$id" pr_url "$url" 2>/dev/null || true
    "${SCRIPT_DIR}/issue_state.sh" "$repo_path" set "$id" pr_id  "$number" 2>/dev/null || true
  fi
}

# _sync_pr_labels_and_state
#   Best-effort, non-fatal sync run after a PR is created/marked ready:
#   adds the `PR` label to the issue, refreshes the issue's `tags` field in
#   `.claude/state/issue-<id>.json` from its current GitHub labels, and, if
#   those tags include `shipit`, adds the PR-only informational
#   `auto-shipit` label directly to the PR (bypassing the shipit guard by
#   construction, since that guard only protects the issue's `shipit`
#   label). No-op silently if the current branch doesn't match `issue-<id>`.
_sync_pr_labels_and_state() {
  local repo_path="$1"
  local id
  id=$(_current_issue_id)
  [[ -n "$id" ]] || return 0

  local repo_ref branch
  repo_ref=$(get_repo_ref "$repo_path")
  branch=$(git branch --show-current)

  tag_mutate_add_label "$id" "$repo_ref" pr \
    || echo "Warning: could not add 'pr' tag to issue #$id on $repo_ref" >&2

  local labels tags_json
  labels=$(gh issue view "$id" -R "$repo_ref" --json labels -q '.labels[].name' 2>/dev/null) || {
    echo "Warning: could not fetch issue #$id from $repo_ref to refresh tags" >&2
    return 0
  }
  tags_json=$(extract_tags "$labels" | jq -R . | jq -s .)
  "${SCRIPT_DIR}/issue_state.sh" "$repo_path" set-json "$id" tags "$tags_json" 2>/dev/null \
    || echo "Warning: could not persist refreshed tags for issue #$id" >&2

  if echo "$tags_json" | jq -e 'index("shipit")' >/dev/null 2>&1; then
    gh pr edit -R "$repo_ref" "$branch" --add-label auto-shipit >/dev/null 2>&1 \
      || echo "Warning: could not add 'auto-shipit' label to PR for issue #$id on $repo_ref" >&2
  fi

  return 0
}

# --- Commands ---

cmd_info() {
  local repo_path="${1:-}"
  [[ -n "$repo_path" ]] || { echo "Usage: $0 info <repo_path>" >&2; exit 1; }

  _load_origin "$repo_path"
  echo "DOMAIN=$_ORIGIN_DOMAIN"
  echo "REPO=$_ORIGIN_REPO_PATH"
}

cmd_pr_create() {
  local repo_path="${1:-}" title="${2:-}" file="${3:-}"
  [[ -n "$repo_path" && -n "$title" && -n "$file" ]] || {
    echo "Usage: $0 pr-create <repo_path> <title> <file>" >&2; exit 1
  }
  [[ -f "$file" ]] || { echo "Error: file not found: $file" >&2; exit 1; }

  _ensure_gh_user
  _load_origin "$repo_path"

  local repo_ref
  repo_ref=$(get_repo_ref "$repo_path")

  local url
  url=$(gh pr create -R "$repo_ref" --title "$title" --body-file "$file") || {
    echo "Error: could not create PR on $repo_ref" >&2
    exit 1
  }

  _persist_pr_state "$repo_path" "$url"
  _sync_pr_labels_and_state "$repo_path"
  echo "$url"
}

cmd_pr_view() {
  local repo_path="${1:-}"
  [[ -n "$repo_path" ]] || { echo "Usage: $0 pr-view <repo_path>" >&2; exit 1; }

  _ensure_gh_user
  _load_origin "$repo_path"

  local repo_ref branch
  repo_ref=$(get_repo_ref "$repo_path")
  branch=$(git branch --show-current)

  local output
  if output=$(gh pr view -R "$repo_ref" "$branch" --json url,isDraft 2>&1); then
    local url is_draft
    url=$(echo "$output" | jq -r '.url')
    is_draft=$(echo "$output" | jq -r '.isDraft')
    _persist_pr_state "$repo_path" "$url"
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
  local repo_path="${1:-}"
  [[ -n "$repo_path" ]] || { echo "Usage: $0 pr-ready <repo_path>" >&2; exit 1; }

  _ensure_gh_user
  _load_origin "$repo_path"

  local repo_ref branch
  repo_ref=$(get_repo_ref "$repo_path")
  branch=$(git branch --show-current)

  gh pr ready -R "$repo_ref" "$branch" >/dev/null || {
    echo "Error: could not mark PR ready on $repo_ref" >&2
    exit 1
  }

  local url
  url=$(gh pr view -R "$repo_ref" "$branch" --json url -q '.url' 2>/dev/null) || true
  if [[ -n "$url" ]]; then
    _persist_pr_state "$repo_path" "$url"
  fi
  _sync_pr_labels_and_state "$repo_path"

  echo "OK"
}

case "${1:-}" in
  info|pr-create|pr-view|pr-ready)
    repo_path_enter "${2:-}"
    ;;
esac

case "${1:-}" in
  info)      shift; cmd_info "$@" ;;
  pr-create) shift; cmd_pr_create "$@" ;;
  pr-view)   shift; cmd_pr_view "$@" ;;
  pr-ready)  shift; cmd_pr_ready "$@" ;;
  *)
    echo "Usage: $0 <command> <repo_path> [args]" >&2
    echo "Commands:" >&2
    echo "  info <repo_path>                        Print DOMAIN and REPO from git origin" >&2
    echo "  pr-create <repo_path> <title> <file>    Create a pull request with title and body from a file" >&2
    echo "  pr-view <repo_path>                     Print URL and IS_DRAFT for the current branch's PR" >&2
    echo "  pr-ready <repo_path>                    Mark the current branch's PR as ready for review" >&2
    exit 1
    ;;
esac
