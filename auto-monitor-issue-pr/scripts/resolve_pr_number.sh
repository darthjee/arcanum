#!/usr/bin/env bash
# Thin engine_dispatch shim for the "auto-monitor-issue-pr-resolve-pr-number"
# migrated entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/435-migrate-auto-monitor-issue-pr-resolve-pr-number-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Resolves the PR number for the
# current branch, via either the shell implementation
# (resolve_pr_number_shell.sh) or the native one (core/bin/arcanum), per
# engine.mode / arcanum/_lib/migration-status.json.
#
# `HOME` is forwarded to the native path's explicit env-var allowlist —
# needed for `gh`/token resolution once native's `env -i PATH="$PATH"`
# strips the ambient environment down, same rationale as github.sh and
# run_checks.sh.
#
# Usage: resolve_pr_number.sh <repo_path> <id>
#
# Output and exit code: unchanged from before this migration — see
# resolve_pr_number_shell.sh's own header for the full behavior contract.

set -euo pipefail

REPO_PATH="${1:-}"
ID="${2:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" auto-monitor-issue-pr-resolve-pr-number "${SCRIPT_DIR}/resolve_pr_number_shell.sh" HOME -- "$@"
