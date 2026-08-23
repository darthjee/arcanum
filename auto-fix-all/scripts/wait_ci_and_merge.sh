#!/usr/bin/env bash
# Thin engine_dispatch shim for the "auto-fix-all-wait-ci-and-merge"
# migrated entrypoint — see docs/agents/architecture/script-engine.md
# and docs/agents/plans/266-migrate-auto-fix-all-wait-ci-and-merge-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Waits for CI, then merges the
# PR internally — the `shipit`-preapproved merge path only (see issue
# #170) — via either the shell implementation
# (wait_ci_and_merge_shell.sh) or the native one (core/bin/arcanum),
# per engine.mode / arcanum/_lib/migration-status.json.
#
# `HOME` is forwarded to the native path's explicit env-var allowlist —
# the orchestrated native calls (`AutoFixAllWaitCi`, `AutoFixAllGithub`)
# resolve GitHub credentials via `gh auth token` internally (through
# GithubToken.js) once native's `env -i PATH="$PATH"` strips the
# ambient environment down; without it, native-mode auth would fail in
# a way shell-mode never does.
#
# Usage: wait_ci_and_merge.sh <repo_path> [model_email]
#
# Output and exit code: unchanged from before this migration — see
# wait_ci_and_merge_shell.sh's own header for the full behavior
# contract.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_PATH="${1:?Usage: $0 <repo_path> [model_email]}"
MODEL_EMAIL="${2:-}"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" auto-fix-all-wait-ci-and-merge "${SCRIPT_DIR}/wait_ci_and_merge_shell.sh" HOME -- "$REPO_PATH" "$MODEL_EMAIL"
