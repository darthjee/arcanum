#!/usr/bin/env bash
# Thin engine_dispatch shim for the "auto-fix-all-wait-ci" migrated
# entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/262-migrate-auto-fix-all-wait-ci-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Blocks until all CI check-runs on
# the current branch's PR head commit complete, via either the shell
# implementation (wait_ci_shell.sh) or the native one (core/bin/arcanum),
# per engine.mode / arcanum/_lib/migration-status.json.
#
# `HOME` is forwarded to the native path's explicit env-var allowlist —
# the native implementation resolves credentials via `gh auth token`
# internally (through GithubToken.js) once native's `env -i PATH="$PATH"`
# strips the ambient environment down; without it, native-mode auth would
# fail in a way shell-mode never does.
#
# Usage: wait_ci.sh <repo_path>
#
# Output and exit code: unchanged from before this migration — see
# wait_ci_shell.sh's own header for the full behavior contract.

set -euo pipefail

REPO_PATH="${1:?Usage: $0 <repo_path>}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" auto-fix-all-wait-ci "${SCRIPT_DIR}/wait_ci_shell.sh" HOME -- "$@"
