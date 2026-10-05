#!/usr/bin/env bash
# Thin per-subcommand engine_dispatch router for the
# "auto-fix-all-github-*" migrated entrypoints — see
# docs/agents/architecture/script-engine.md and
# docs/agents/plans/656-route-auto-fix-all-scripts-github-sh-through-engine-dispatch-native-counterparts-unreachable/plan.md
# for the full design/shared contracts. This script bundles eight
# subcommands, so it must resolve the right migration-status.json/COMMANDS
# key from $1 before calling engine_dispatch, once per invocation — never
# for the whole script. The bash implementation lives in github_shell.sh.
#
# HOME is forwarded to the native path's explicit env-var allowlist for
# all eight subcommands: every one of them either resolves a GitHub token
# via `gh` (which needs HOME to find its own auth config) or runs git
# operations that rely on the user's git config/credentials, once
# native's `env -i PATH="$PATH"` strips the ambient environment down.
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
#   pr-number <repo_path>               Print the PR number (no '#') for the current branch
#   pr-state <repo_path>                Print STATE=<OPEN|MERGED|CLOSED> for the current branch's PR
#   pr-merge <repo_path> [model_email]  Squash-merge the current branch's PR, print its URL
#   cleanup-branch <repo_path> <id>     Delete the issue's remote and local branch, switch back to main
#   has-label <repo_path> <id> <name>   Exit 0 if GitHub issue <id> has a label equal to <name>
#                                       (case-insensitive, whole name, literal match); exit 1
#                                       if none matches (or on usage error); exit 2 if the
#                                       labels could not be determined (gh user setup, repo
#                                       ref resolution or `gh issue view` failed)
#   has-shipit-label <repo_path> <id>   Alias for `has-label <repo_path> <id> shipit`
#   add-tag <repo_path> <id> <tag>      Add a single tag to GitHub issue <id>
#   remove-tag <repo_path> <id> <tag>   Remove a single tag from GitHub issue <id>
#
# `has-shipit-label` is a pure alias: it routes to the SAME
# "auto-fix-all-github-has-label" key and github_shell_has_label.sh wrapper
# with args `<repo_path> <id> shipit` — it has no migration-status.json
# key, registry entry or native method of its own.
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
  pr-number)
    engine_dispatch "$REPO_PATH" auto-fix-all-github-pr-number "${SCRIPT_DIR}/github_shell_pr_number.sh" HOME -- "${@:2}"
    ;;
  pr-state)
    engine_dispatch "$REPO_PATH" auto-fix-all-github-pr-state "${SCRIPT_DIR}/github_shell_pr_state.sh" HOME -- "${@:2}"
    ;;
  pr-merge)
    engine_dispatch "$REPO_PATH" auto-fix-all-github-pr-merge "${SCRIPT_DIR}/github_shell_pr_merge.sh" HOME -- "${@:2}"
    ;;
  cleanup-branch)
    engine_dispatch "$REPO_PATH" auto-fix-all-github-cleanup-branch "${SCRIPT_DIR}/github_shell_cleanup_branch.sh" HOME -- "${@:2}"
    ;;
  has-label)
    engine_dispatch "$REPO_PATH" auto-fix-all-github-has-label "${SCRIPT_DIR}/github_shell_has_label.sh" HOME -- "${@:2}"
    ;;
  has-shipit-label)
    engine_dispatch "$REPO_PATH" auto-fix-all-github-has-label "${SCRIPT_DIR}/github_shell_has_label.sh" HOME -- "${2:-}" "${3:-}" shipit
    ;;
  add-tag)
    engine_dispatch "$REPO_PATH" auto-fix-all-github-add-tag "${SCRIPT_DIR}/github_shell_add_tag.sh" HOME -- "${@:2}"
    ;;
  remove-tag)
    engine_dispatch "$REPO_PATH" auto-fix-all-github-remove-tag "${SCRIPT_DIR}/github_shell_remove_tag.sh" HOME -- "${@:2}"
    ;;
  *)
    echo "Usage: $0 <command> <repo_path> [args]" >&2
    echo "Commands:" >&2
    echo "  pr-number <repo_path>               Print the PR number (no '#') for the current branch" >&2
    echo "  pr-state <repo_path>                Print STATE=<OPEN|MERGED|CLOSED> for the current branch's PR" >&2
    echo "  pr-merge <repo_path> [model_email]  Squash-merge the current branch's PR, print its URL" >&2
    echo "  cleanup-branch <repo_path> <id>     Delete the issue's remote and local branch, switch back to main" >&2
    echo "  has-label <repo_path> <id> <name>   Exit 0 if GitHub issue <id> has a label equal to <name> (case-insensitive, literal); exit 1 if none matches, exit 2 if labels could not be determined" >&2
    echo "  has-shipit-label <repo_path> <id>   Alias for 'has-label <repo_path> <id> shipit'" >&2
    echo "  add-tag <repo_path> <id> <tag>      Add a single tag to GitHub issue <id>, mapped to a real GitHub label via arcanum/_lib/tags.sh" >&2
    echo "  remove-tag <repo_path> <id> <tag>   Remove a single tag from GitHub issue <id>, mapped to a real GitHub label via arcanum/_lib/tags.sh" >&2
    exit 1
    ;;
esac
