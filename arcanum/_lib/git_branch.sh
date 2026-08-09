# Shared git branch fetch/merge helpers.
#
# This file is meant to be SOURCED, not executed directly — it defines
# functions used by scripts that need to fetch and merge "origin/main"
# into whatever branch is currently checked out, tolerating a missing
# "origin/main" ref (e.g. a repository where main has never been pushed).
#
# Guard against double-sourcing:
[[ -n "${_LIB_GIT_BRANCH_LOADED:-}" ]] && return 0
_LIB_GIT_BRANCH_LOADED=1

# git_branch_fetch_main
#   Runs `git fetch origin main`. Tolerates a missing remote ref (stderr
#   matching "couldn't find remote ref"/"not found"/"no such ref",
#   case-insensitive) as a non-error; any other fetch failure is a hard
#   error (printed to stderr, exit 1 — this ends the calling script too,
#   since that's a genuine failure, not a tolerated case).
git_branch_fetch_main() {
  local err_file="/tmp/git_branch_fetch_main.$$"

  if ! git fetch origin main 2>"$err_file"; then
    local fetch_err
    fetch_err=$(cat "$err_file" 2>/dev/null || true)
    rm -f "$err_file"
    if ! echo "$fetch_err" | grep -qiE "couldn't find remote ref|not found|no such ref"; then
      echo "Error: git fetch origin main failed: $fetch_err" >&2
      exit 1
    fi
    return 0
  fi

  rm -f "$err_file"
}

# git_branch_merge_main
#   Calls git_branch_fetch_main, then, only if "refs/remotes/origin/main"
#   exists, runs `git merge --no-edit origin/main` on the currently
#   checked-out branch.
#   - Returns 0 when there is nothing to merge (no "origin/main" ref) or
#     the merge completed cleanly.
#   - On a real conflict, does NOT abort the merge — it leaves the
#     conflict markers in the working tree, prints each conflicted path
#     (one per line, via `git diff --name-only --diff-filter=U`) to
#     stdout, and returns 2, so callers can react.
git_branch_merge_main() {
  git_branch_fetch_main

  git show-ref --verify --quiet "refs/remotes/origin/main" || return 0

  if ! git merge --no-edit origin/main; then
    git diff --name-only --diff-filter=U
    return 2
  fi

  return 0
}
