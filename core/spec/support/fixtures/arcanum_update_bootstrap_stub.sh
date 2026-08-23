#!/usr/bin/env bash
# Deterministic stand-in for arcanum/update/bootstrap.sh, used only by
# arcanumUpdateRunUpdateParity_spec.js (issue #263) to exercise
# run_update_apply_shell.sh / the arcanum-update-run-update-apply native
# command's "apply" success/failure paths without a real network
# install. Copied verbatim into each fixture's own
# arcanum/update/bootstrap.sh, then made executable — never run in
# place. Controlled entirely via marker files placed alongside the
# fixture's own install root (two levels up from this script's own
# location once copied, i.e. <root>/arcanum/update/bootstrap.sh):
#
#   - <root>/.fixture-fail present -> prints one line to stdout, one to
#     stderr (both meant to be observed live, exactly like a real
#     bootstrap.sh failure), then exits with that file's own (trimmed)
#     contents as the exit code, defaulting to 1 if empty/unreadable.
#   - <root>/.fixture-new-version present (and no .fixture-fail) ->
#     overwrites <root>/arcanum.json's "version" field with that file's
#     (trimmed) contents via jq, then exits 0 — simulating a real
#     version bump. Absent -> exits 0 without touching arcanum.json,
#     simulating a no-op "already up to date" run.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "bootstrap: starting"

if [[ -f "${ROOT}/.fixture-fail" ]]; then
  echo "bootstrap: simulated failure" >&2
  CODE="$(cat "${ROOT}/.fixture-fail" 2>/dev/null || true)"
  exit "${CODE:-1}"
fi

if [[ -f "${ROOT}/.fixture-new-version" ]]; then
  NEW_VERSION="$(cat "${ROOT}/.fixture-new-version")"
  jq --arg v "$NEW_VERSION" '.version = $v' "${ROOT}/arcanum.json" > "${ROOT}/arcanum.json.tmp"
  mv "${ROOT}/arcanum.json.tmp" "${ROOT}/arcanum.json"
fi

echo "bootstrap: done"
