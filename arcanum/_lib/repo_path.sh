#!/usr/bin/env bash
# Shared repo-path validation/cd helper
# Sourced, not executed.

# repo_path_enter <repo_path>
#   Validates <repo_path> exists and is a git repo (or worktree), then cd's
#   into it. Fails loudly (message to stderr, exit 1) instead of silently
#   operating elsewhere.
repo_path_enter() {
  local repo_path="${1:-}"
  [[ -n "$repo_path" ]] || { echo "Error: repo_path is required" >&2; exit 1; }
  [[ -d "$repo_path" ]] || { echo "Error: not a directory: $repo_path" >&2; exit 1; }
  git -C "$repo_path" rev-parse --git-dir >/dev/null 2>&1 || {
    echo "Error: not a git repository: $repo_path" >&2; exit 1
  }
  cd "$repo_path"
}
