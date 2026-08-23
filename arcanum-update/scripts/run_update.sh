#!/usr/bin/env bash
# Thin per-subcommand engine_dispatch shim for the
# "arcanum-update-run-update-*" migrated entrypoints — see
# docs/agents/architecture/script-engine.md and
# docs/agents/plans/263-migrate-arcanum-update-run-update-entrypoint-check-apply-to-native-node-js/plan.md
# for the full design/shared contracts. Resolves and drives an arcanum
# self-update, for the arcanum-update skill, via either the shell
# implementation (run_update_<subcommand>_shell.sh) or the native one
# (core/bin/arcanum), per engine.mode / arcanum/_lib/migration-status.json.
#
# Usage: run_update.sh check
#        run_update.sh apply
#
# Both subcommands resolve TARGET/METHOD/REPO relative to this script's
# own location (<script_dir>/../.. — the install this skill lives
# inside), NOT any repo_path argument — this entrypoint takes none, and
# TARGET_PATH is self-resolved here, once, and passed as the sole
# positional argument to whichever implementation actually runs.
#
# `check` prints, one per line (order matters — simple KEY=value parsing
# on the caller's side): METHOD=zip|git, REPO=<repo>, CURRENT=<version-or
# -ref>, TARGET=<path>. Exits 0.
#
# `apply` sets ARCANUM_ASSUME_YES=1 and runs arcanum/update/bootstrap.sh
# directly, streaming its stdout/stderr live (not captured/suppressed).
# On nonzero exit, propagates that same exit code with no further output
# (the caller relays the already-streamed error). On exit 0, re-resolves
# the current version/ref and prints one final line:
#   RESULT=updated FROM=<old> TO=<new>   (something changed)
#   RESULT=noop VERSION=<current>        (already up to date)
#
# Both subcommands: if arcanum/update/bootstrap.sh is missing entirely,
# or neither arcanum.json nor .git is present at TARGET_PATH, prints
# "STATUS=missing_arcanum" to stdout and exits 1.
#
# Requires jq (zip-path case only) and git (git-path case only) — both
# already hard dependencies of the scripts this wraps.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_PATH="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"

case "${1:-}" in
  check)
    engine_dispatch "$TARGET_PATH" arcanum-update-run-update-check "${SCRIPT_DIR}/run_update_check_shell.sh" -- "$TARGET_PATH"
    ;;
  apply)
    engine_dispatch "$TARGET_PATH" arcanum-update-run-update-apply "${SCRIPT_DIR}/run_update_apply_shell.sh" HOME -- "$TARGET_PATH"
    ;;
  *)
    echo "Usage: $0 check" >&2
    echo "       $0 apply" >&2
    exit 1
    ;;
esac
