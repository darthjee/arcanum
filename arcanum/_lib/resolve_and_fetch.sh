#!/usr/bin/env bash
# Thin engine_dispatch shim for the "resolve-and-fetch" migrated
# entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/193-migrate-resolve-and-fetch-sh-to-a-native--node-js--implementation/plan.md
# for the full design/shared contracts. Resolves an issue id ('#<id>')
# and guarantees its content exists locally, fetching from GitHub when
# needed, via either the shell implementation
# (resolve_and_fetch_shell.sh) or the native one (core/bin/arcanum),
# per engine.mode / arcanum/_lib/migration-status.json.
#
# `HOME` is forwarded to the native path's explicit env-var allowlist —
# `gh auth token` (called deeper in the shell implementation via
# github_issue.sh) needs it to find its own config once native's
# `env -i PATH="$PATH"` strips the ambient environment down; without it,
# native-mode auth would fail in a way shell-mode never does.
#
# Usage: resolve_and_fetch.sh <repo_path> <issues_folder> <arg_string>
#
# Output (key=value lines) and exit code: unchanged from before this
# migration — see resolve_and_fetch_shell.sh's own header for the full
# STATUS=ok/STATUS=error contract.

set -euo pipefail

REPO_PATH="${1:-}"
[[ -n "$REPO_PATH" ]] || { echo "Usage: $0 <repo_path> <issues_folder> [arg_string]" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=engine_dispatch.sh
source "${SCRIPT_DIR}/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" resolve-and-fetch "${SCRIPT_DIR}/resolve_and_fetch_shell.sh" HOME -- "$@"
