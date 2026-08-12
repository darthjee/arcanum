#!/usr/bin/env bash
# Interactive loop offering pending migration versions one at a time.
# Usage: select_version.sh
#
# Recomputes the pending-versions list (folders under
# arcanum/migrations/repos/, excluding "next", strictly greater than
# the repo's currently recorded version — same semver-aware comparison
# run.sh uses, via the shared _pending_versions.sh helper) on every
# loop iteration, since a prior iteration may have advanced the
# recorded version. Prints the list plus a [D]one option, reading
# choices from /dev/tty in a loop.
#
# On a version-like input (NOT validated against the pending list — any
# string typed is accepted and passed straight through), calls
# update_per_version.sh for it (confirmation still required at that
# level). If it exits 2 (halt), stops the loop immediately and exits 2.
# Otherwise loops back to the prompt. On [D], exits 0.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_SCRIPT_DIR="$SCRIPT_DIR"
CONFIG_FILE=".claude/configuration/arcanum-repo-config.json"

# shellcheck source=../_lib/repo_config.sh
source "${SCRIPT_DIR}/../_lib/repo_config.sh"
# shellcheck source=_pending_versions.sh
source "${SCRIPT_DIR}/_pending_versions.sh"

while true; do
  CURRENT_VERSION="$(repo_config_get_version "$CONFIG_FILE")"
  CURRENT_VERSION="${CURRENT_VERSION:-0.0.0}"

  PENDING=()
  while IFS= read -r v; do
    [[ -n "$v" ]] && PENDING+=("$v")
  done < <(_pending_versions "$CURRENT_VERSION")

  echo "Pending versions:"
  for v in "${PENDING[@]}"; do
    echo "  $v"
  done
  printf 'Select a version (or [D]one): '
  read -r choice < /dev/tty

  case "$choice" in
    [Dd]*|"")
      exit 0
      ;;
    *)
      rc=0
      "${SCRIPT_DIR}/update_per_version.sh" "$choice" || rc=$?
      [[ "$rc" -eq 2 ]] && exit 2
      ;;
  esac
done
