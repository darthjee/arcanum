#!/usr/bin/env bash
# Shell implementation of the "arcanum-update-run-update-apply" migrated
# entrypoint — invoked by run_update.sh's engine_dispatch shim.
# Usage: run_update_apply_shell.sh <target_path>
#
# Resolves METHOD/REPO relative to <target_path> (the arcanum install
# this skill lives inside — resolved by the caller, not by this script),
# same detection rules as run_update_check_shell.sh:
#   - Neither arcanum.json nor .git present at <target_path>, or
#     arcanum/update/bootstrap.sh missing entirely (partial/manual
#     install) -> prints "STATUS=missing_arcanum" to stdout and exits 1.
#
# Sets ARCANUM_ASSUME_YES=1 and runs <target_path>/arcanum/update/bootstrap.sh
# directly, streaming its stdout/stderr live (not captured/suppressed).
# On nonzero exit, propagates that same exit code with no further output
# (the caller relays the already-streamed error). On exit 0, re-resolves
# the current version/ref and prints one final line:
#   RESULT=updated FROM=<old> TO=<new>   (something changed)
#   RESULT=noop VERSION=<current>        (already up to date)
#
# Requires jq (zip-path case only) and git (git-path case only) — both
# already hard dependencies of the scripts this wraps.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=run_update_common.sh
source "${SCRIPT_DIR}/run_update_common.sh"

TARGET_PATH_ARG="${1:-}"
[[ -n "$TARGET_PATH_ARG" ]] || { echo "Usage: $0 <target_path>" >&2; exit 1; }

if ! resolve_target "$TARGET_PATH_ARG"; then
  echo "STATUS=missing_arcanum"
  exit 1
fi

BOOTSTRAP="${TARGET_PATH}/arcanum/update/bootstrap.sh"

BEFORE="$(current_version)"

export ARCANUM_ASSUME_YES=1

RC=0
"$BOOTSTRAP" || RC=$?
if [[ "$RC" -ne 0 ]]; then
  exit "$RC"
fi

AFTER="$(current_version)"

if [[ "$AFTER" != "$BEFORE" ]]; then
  echo "RESULT=updated FROM=${BEFORE} TO=${AFTER}"
else
  echo "RESULT=noop VERSION=${AFTER}"
fi
