# Shared "safe branch" checkout helpers.
#
# This file is meant to be SOURCED, not executed directly — it defines
# functions used by skills that need to park the working tree on a
# configurable, known-safe ref (default "origin/main") before/after
# doing GitHub-only work (fetching/discussing/splitting an issue) that
# doesn't need to happen on any particular branch. Kept separate from
# git_branch.sh's fetch/merge-main concern (see docs/agents/architecture.md's
# "Branch Bootstrap and Merge Conflicts" section) — this file never merges
# anything, it only ever moves the working tree.
#
# No repo_path argument on either function below — operates on the
# ambient cwd, which callers must have already entered via
# repo_path_enter (see docs/agents/architecture.md's "Repo Path
# Threading" section).
#
# Guard against double-sourcing:
[[ -n "${_LIB_SAFE_BRANCH_LOADED:-}" ]] && return 0
_LIB_SAFE_BRANCH_LOADED=1

_SAFE_BRANCH_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=repo_config.sh
source "${_SAFE_BRANCH_LIB_DIR}/repo_config.sh"

# safe_branch_get
#   Prints the configured safe branch: the "git"."safe_branch" key from
#   .claude/state/arcanum-config.json (no legacy fallback file — this
#   key has no legacy predecessor), quote-stripped. Defaults to
#   "origin/main" when the key is empty/absent.
safe_branch_get() {
  local branch
  branch=$(repo_config_read ".claude/state/arcanum-config.json" "" "git" "safe_branch")
  branch="${branch//\"/}"
  [[ -n "$branch" ]] || branch="origin/main"
  echo "$branch"
}

# safe_branch_checkout
#   1. Dirty check: if there are uncommitted changes to tracked files
#      (staged or unstaged — untracked files are ignored, they never
#      block a checkout), prints a clear error to stderr and exits 1.
#      Never stashes/discards anything.
#   2. `git fetch -p` — a plain, unscoped fetch+prune of git's single
#      default remote (NOT `git fetch --all --prune`) — matches the
#      issue's literal wording and incidentally clears stale
#      `issue-<id>` remote-tracking refs.
#   3. `git checkout "$(safe_branch_get)"` — lands on a detached HEAD
#      (e.g. "origin/main" is a remote-tracking ref, not a local
#      branch); no local tracking branch is created or needed, since
#      callers never commit while parked here.
#   4. Prints `BRANCH=<resolved branch>` on success.
safe_branch_checkout() {
  if ! git diff --quiet --exit-code || ! git diff --cached --quiet --exit-code; then
    echo "Error: working tree has uncommitted changes to tracked files — refusing to switch to the safe branch (would risk losing your work). Commit or discard your changes first." >&2
    exit 1
  fi

  git fetch -p

  local branch
  branch="$(safe_branch_get)"
  git checkout "$branch"

  echo "BRANCH=${branch}"
}
