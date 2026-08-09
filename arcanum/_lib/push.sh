# Shared push helpers.
#
# This file is meant to be SOURCED, not executed directly — it defines
# functions used by scripts that need to push the current branch to origin.

push_current_branch() {
  local branch
  branch=$(git branch --show-current)
  git push -u origin "${branch}:${branch}"
}
