#!/usr/bin/env bash
# Shell implementation of the "arcanum-update-run-update-check" migrated
# entrypoint — invoked by run_update.sh's engine_dispatch shim.
# Usage: run_update_check_shell.sh <target_path>
#
# Resolves METHOD/REPO/CURRENT relative to <target_path> (the arcanum
# install this skill lives inside — resolved by the caller, not by this
# script), mirroring arcanum/update/bootstrap.sh's own on-disk-location
# detection:
#   - arcanum.json present at <target_path> -> METHOD=zip, REPO/CURRENT
#     read from it (via jq).
#   - arcanum.json absent, .git present -> METHOD=git, REPO parsed from
#     `git remote get-url origin`, CURRENT is the exact tag on HEAD if
#     any, else the short commit hash.
#   - Neither present, or arcanum/update/bootstrap.sh missing entirely
#     (partial/manual install) -> prints "STATUS=missing_arcanum" to
#     stdout and exits 1.
#
# Prints, one per line (order matters — simple KEY=value parsing on the
# caller's side): METHOD=zip|git, REPO=<repo>, CURRENT=<version-or-ref>,
# TARGET=<path>. Exits 0.
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

CURRENT="$(current_version)"

echo "METHOD=${METHOD}"
echo "REPO=${REPO}"
echo "CURRENT=${CURRENT}"
echo "TARGET=${TARGET_PATH}"
