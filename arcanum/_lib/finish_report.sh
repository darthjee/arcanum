#!/usr/bin/env bash
# Thin engine_dispatch shim for the "finish-report" migrated entrypoint —
# see docs/agents/architecture/skill-finish.md and
# docs/agents/architecture/script-engine.md for the full
# design/contracts. Renders an issue skill's closing report (or,
# with --nested, its FINISH_* result-data block) via either the shell
# implementation (finish_report_shell.sh) or the native one
# (core/bin/arcanum finish-report), per engine.mode /
# arcanum/_lib/migration-status.json.
#
# Pure formatting plus local git-origin parsing — no gh/GitHub API
# dependency, so no env vars are forwarded to the native path.
#
# Usage:
#   finish_report.sh <repo_path> --skill <name> --status success|declined|failed \
#     --summary "<text>" [--issue <id>] [--pr <number>] [--sub-issue <id>]... \
#     [--label-change <before_tag>:<after_tag>]... [--next "<command>"]... \
#     [--merge "<nested block>"]... [--nested]
#
# Output and exit code: see finish_report_shell.sh's own header for the
# full report / FINISH_* block contract (exit 0 on success, exit 1 with
# nothing on stdout on any usage error).

set -euo pipefail

REPO_PATH="${1:-}"

[[ -n "$REPO_PATH" ]] || {
  echo "Usage: $0 <repo_path> --skill <name> --status success|declined|failed --summary \"<text>\" [flags...]" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=engine_dispatch.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" finish-report "${SCRIPT_DIR}/finish_report_shell.sh" -- "$@"
