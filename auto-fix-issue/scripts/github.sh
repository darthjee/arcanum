#!/usr/bin/env bash
# Thin per-subcommand engine_dispatch router for the
# "auto-fix-issue-github-*" migrated entrypoints — see
# docs/agents/architecture/script-engine.md and
# docs/agents/plans/430-migrate-auto-fix-issue-github-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Unlike a single-command shim
# (commit_change.sh, run_checks.sh), this script bundles four
# subcommands (info, pr-create, pr-view, pr-ready), so it must resolve
# the right migration-status.json/COMMANDS key from $1 before calling
# engine_dispatch, once per invocation — never for the whole script.
#
# HOME is forwarded to the native path's explicit env-var allowlist for
# pr-create/pr-view/pr-ready only (all three resolve a GitHub token via
# `gh`, which needs HOME to find its own auth config once native's
# `env -i PATH="$PATH"` strips the ambient environment down); info needs
# no env vars (git-only, no gh call), following the no-env-var
# precedent of the other read-only entrypoints (list_plan_agents.sh).
#
# engine_dispatch passes its OWN trailing <args...> unchanged to BOTH the
# shell fallback and the native command — but those two need different
# argv shapes here: native needs `<repo_path> [rest]` (no subcommand;
# <command> already encodes it — core/lib/core/dispatcher.js's repoContext
# always binds args[0] as repoPath for context:'repo' commands), while
# github_shell.sh needs `<subcommand> <repo_path> [rest]` (it dispatches
# on $1 itself). To reconcile: we pass engine_dispatch "${@:2}" (i.e.
# <repo_path> [rest], no subcommand) and point <shell_script> at a tiny
# per-subcommand wrapper (github_shell_<subcommand>.sh) that just
# re-prepends its own fixed subcommand literal and execs into the real
# github_shell.sh — keeping all the actual command logic/shared helpers
# in that one file, unduplicated.
#
# Usage: github.sh <command> <repo_path> [args]
#   info <repo_path>                        Print DOMAIN and REPO from git origin
#   pr-create <repo_path> <title> <file>    Create a pull request with title and body from a file
#   pr-view <repo_path>                     Print URL and IS_DRAFT for the current branch's PR
#   pr-ready <repo_path>                    Mark the current branch's PR as ready for review
#
# An unknown or missing subcommand prints this usage to stderr and exits
# 1 — it never falls through to github_shell.sh.
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
    engine_dispatch "$REPO_PATH" auto-fix-issue-github-info "${SCRIPT_DIR}/github_shell_info.sh" -- "${@:2}"
    ;;
  pr-create)
    engine_dispatch "$REPO_PATH" auto-fix-issue-github-pr-create "${SCRIPT_DIR}/github_shell_pr_create.sh" HOME -- "${@:2}"
    ;;
  pr-view)
    engine_dispatch "$REPO_PATH" auto-fix-issue-github-pr-view "${SCRIPT_DIR}/github_shell_pr_view.sh" HOME -- "${@:2}"
    ;;
  pr-ready)
    engine_dispatch "$REPO_PATH" auto-fix-issue-github-pr-ready "${SCRIPT_DIR}/github_shell_pr_ready.sh" HOME -- "${@:2}"
    ;;
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
