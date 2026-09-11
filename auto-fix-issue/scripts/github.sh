#!/usr/bin/env bash
# Thin per-subcommand engine_dispatch router for the
# "auto-fix-issue-github-*" migrated entrypoints — see
# docs/agents/architecture/script-engine.md and
# docs/agents/plans/430-migrate-auto-fix-issue-github-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Unlike a single-command shim
# (commit_change.sh, create_branch.sh), this script bundles four
# subcommands (info, pr-create, pr-view, pr-ready), so it must resolve
# the right migration-status.json/COMMANDS key from $1 before calling
# engine_dispatch, once per invocation — never for the whole script.
#
# HOME is forwarded to the native path's explicit env-var allowlist for
# pr-create/pr-view/pr-ready only (all three resolve a GitHub token via
# `gh`, which needs HOME to find its own auth config once native's
# `env -i PATH="$PATH"` strips the ambient environment down); info needs
# no env vars (git-only, no gh call), mirroring create_branch.sh's
# no-env-var precedent for a git-only entrypoint.
#
# Usage: github.sh <command> <repo_path> [args]
#   info <repo_path>                        Print DOMAIN and REPO from git origin
#   pr-create <repo_path> <title> <file>    Create a pull request with title and body from a file
#   pr-view <repo_path>                     Print URL and IS_DRAFT for the current branch's PR
#   pr-ready <repo_path>                    Mark the current branch's PR as ready for review
#
# Output and exit code: unchanged from before this migration — see
# github_shell.sh's own header for the full per-subcommand contract.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"

SUBCOMMAND="${1:-}"
REPO_PATH="${2:-}"

case "$SUBCOMMAND" in
  info)
    engine_dispatch "$REPO_PATH" auto-fix-issue-github-info "${SCRIPT_DIR}/github_shell.sh" -- "$@"
    ;;
  pr-create)
    engine_dispatch "$REPO_PATH" auto-fix-issue-github-pr-create "${SCRIPT_DIR}/github_shell.sh" HOME -- "$@"
    ;;
  pr-view)
    engine_dispatch "$REPO_PATH" auto-fix-issue-github-pr-view "${SCRIPT_DIR}/github_shell.sh" HOME -- "$@"
    ;;
  pr-ready)
    engine_dispatch "$REPO_PATH" auto-fix-issue-github-pr-ready "${SCRIPT_DIR}/github_shell.sh" HOME -- "$@"
    ;;
  *)
    exec bash "${SCRIPT_DIR}/github_shell.sh" "$@"
    ;;
esac
