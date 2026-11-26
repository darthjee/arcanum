# shellcheck shell=bash
# Shared push helpers.
#
# This file is meant to be SOURCED, not executed directly — it defines
# functions used by scripts that need to push the current branch to origin.
#
# Both helpers are strict: on a detached HEAD (`git branch --show-current`
# prints nothing) they print
#   refusing to push: no current branch (detached HEAD?)
# on stderr and return 1, and `push_current_branch` never runs `git push`
# (an empty branch would degrade the refspec to `:`, "push all matching
# branches"). Callers wanting best-effort behaviour must tolerate the
# failure themselves (e.g. `push_current_branch 2>/dev/null || true`).

PUSH_REFUSAL_MESSAGE="refusing to push: no current branch (detached HEAD?)"

# Prints the current branch name on stdout and returns 0; on a detached
# HEAD, prints the refusal on stderr and returns 1.
require_current_branch() {
  local branch
  branch=$(git branch --show-current)
  if [[ -z "$branch" ]]; then
    echo "$PUSH_REFUSAL_MESSAGE" >&2
    return 1
  fi
  printf '%s\n' "$branch"
}

push_current_branch() {
  local branch
  branch=$(require_current_branch) || return 1
  git push -u origin "${branch}:${branch}"
}
