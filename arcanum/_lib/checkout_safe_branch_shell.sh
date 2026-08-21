#!/usr/bin/env bash
# Shell implementation of the "checkout-safe-branch" migrated entrypoint —
# see docs/agents/architecture/script-engine.md and
# docs/agents/plans/233-migrate-checkout-safe-branch-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Invoked either directly (when
# engine.mode=shell) or as the fallback for engine.mode=native without
# a native implementation yet, via arcanum/_lib/checkout_safe_branch.sh's
# engine_dispatch shim — never called directly by skills.
#
# Enters <repo_path> (repo_path.sh's repo_path_enter — validates it's a
# git repo, cd's into it), then runs safe_branch_checkout: hard-errors on
# a dirty tracked-file working tree, otherwise fetches+prunes and checks
# out the configured safe branch (default "origin/main", detached HEAD).
# Prints "BRANCH=<resolved branch>" on success. Mirrors how
# auto-fix-all/scripts/checkout_from_main.sh wraps git_branch.sh.
# Usage: checkout_safe_branch_shell.sh <repo_path>

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
