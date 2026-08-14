#!/usr/bin/env bash
# Executable CLI wrapper around _ledger.sh, for callers that can only
# invoke real executables (e.g. arcanum-migrate/SKILL.md, run as the
# architect, which has no way to source a library directly).
#
# Usage: ledger.sh is-complete <repo_path> <version> <id>
#        ledger.sh mark-complete <repo_path> <version> <id>
#
# is-complete   -> exits 0 if already marked complete, 1 otherwise.
# mark-complete -> lock-protected append/dedupe; exits 0.
#
# See _ledger.sh for the ledger file schema and full contract.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../_lib/lock.sh
source "${SCRIPT_DIR}/../_lib/lock.sh"
# shellcheck source=_ledger.sh
source "${SCRIPT_DIR}/_ledger.sh"

USAGE="Usage: $0 is-complete|mark-complete <repo_path> <version> <id>"

COMMAND="${1:?$USAGE}"
REPO_PATH="${2:?$USAGE}"
VERSION="${3:?$USAGE}"
ID="${4:?$USAGE}"

case "$COMMAND" in
  is-complete)
    _ledger_is_complete "$REPO_PATH" "$VERSION" "$ID"
    ;;
  mark-complete)
    _ledger_mark_complete "$REPO_PATH" "$VERSION" "$ID"
    ;;
  *)
    echo "$USAGE" >&2
    exit 1
    ;;
esac
