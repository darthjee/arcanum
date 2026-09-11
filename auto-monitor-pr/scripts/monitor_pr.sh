#!/usr/bin/env bash
# Thin engine_dispatch shim for the "auto-monitor-pr-monitor-pr" migrated
# entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/436-migrate-auto-monitor-pr-monitor-pr-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Single-pass check for
# merge/close/approval/new-owner-comments on a PR, via either the shell
# implementation (monitor_pr_shell.sh) or the native one (core/bin/arcanum),
# per engine.mode / arcanum/_lib/migration-status.json.
#
# `HOME` is forwarded to the native path's explicit env-var allowlist —
# needed for `gh`/token resolution once native's `env -i PATH="$PATH"`
# strips the ambient environment, same rationale as resolve_pr_number.sh
# and run_checks.sh.
#
# Usage: monitor_pr.sh <repo_path> --pr-number <pr_number> [--issue-id <id>]
#
# Output and exit code: unchanged from before this migration — see
# monitor_pr_shell.sh's own header for the full behavior contract.

set -euo pipefail

REPO_PATH="${1:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" auto-monitor-pr-monitor-pr "${SCRIPT_DIR}/monitor_pr_shell.sh" HOME -- "$@"
