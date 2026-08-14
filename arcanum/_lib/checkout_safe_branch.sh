#!/usr/bin/env bash
# Executable CLI wrapper around safe_branch.sh's checkout helper.
# Usage: checkout_safe_branch.sh <repo_path>
#
# Enters <repo_path> (repo_path.sh's repo_path_enter — validates it's a
# git repo, cd's into it), then runs safe_branch_checkout: hard-errors on
# a dirty tracked-file working tree, otherwise fetches+prunes and checks
# out the configured safe branch (default "origin/main", detached HEAD).
# Prints "BRANCH=<resolved branch>" on success. Mirrors how
# auto-fix-all/scripts/checkout_from_main.sh wraps git_branch.sh.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=repo_path.sh
source "${SCRIPT_DIR}/repo_path.sh"
# shellcheck source=safe_branch.sh
source "${SCRIPT_DIR}/safe_branch.sh"

REPO_PATH="${1:-}"

[[ -n "$REPO_PATH" ]] || {
  echo "Usage: $0 <repo_path>" >&2
  exit 1
}

repo_path_enter "$REPO_PATH"

safe_branch_checkout
