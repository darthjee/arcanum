#!/usr/bin/env bash
# Thin engine_dispatch shim for the "auto-fix-issue-run-checks" migrated
# entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/434-migrate-auto-fix-issue-run-checks-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Runs the check script for a given
# agent, if one exists, via either the shell implementation
# (run_checks_shell.sh) or the native one (core/bin/arcanum), per
# engine.mode / arcanum/_lib/migration-status.json.
#
# `HOME` is forwarded to the native path's explicit env-var allowlist —
# the check script is arbitrary, project-defined content that may itself
# need `$HOME` to resolve its own config/cache dirs, the same rationale
# commit_change.sh's shim already forwards `HOME` for.
#
# Usage: run_checks.sh <agent>
#
# Like list_plan_agents.sh/list_plan_steps.sh, this entrypoint does not
# take <repo_path> as its own argument — the check script is resolved
# relative to the caller's cwd (the target project's root). engine_dispatch()
# still needs a repo_path for its config_chain_read call, so it is derived
# here from the ambient git checkout rather than adding a new argument.
#
# Output and exit code: unchanged from before this migration — see
# run_checks_shell.sh's own header for the full behavior contract.

set -euo pipefail

AGENT="${1:-}"

[[ -n "$AGENT" ]] || {
  echo "Usage: $0 <agent>" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"

REPO_PATH="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

engine_dispatch "$REPO_PATH" auto-fix-issue-run-checks "${SCRIPT_DIR}/run_checks_shell.sh" HOME -- "$@"
