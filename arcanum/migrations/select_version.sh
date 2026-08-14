#!/usr/bin/env bash
# Interactive loop offering pending migration versions one at a time.
# Usage: select_version.sh [--repo <path>]
#
# --repo <path> is optional, trailing, and defaults to "." (today's
# cwd-relative behavior, unchanged). Forwarded verbatim into every
# update_per_version.sh call this script makes. The arcanum install
# location itself (SCRIPT_DIR, derived from BASH_SOURCE) is never
# affected by --repo.
#
# Recomputes the pending-versions list (folders under
# arcanum/migrations/repos/ whose manifest has a "repo"-scoped entry
# beyond the committed version or a "local"-scoped entry beyond the
# local version — same dual-pointer, scope-aware comparison run.sh
# uses, via the shared _pending_versions.sh/_manifest.sh helpers) on
# every loop iteration, since a prior iteration may have advanced
# either recorded version. Prints the list plus [D]one and [C]hat
# options, verifying /dev/tty is actually open/readable before each
# read (failing fast to stderr, exit 1, if not).
#
# On a version-like input (NOT validated against the pending list — any
# string typed is accepted and passed straight through), calls
# update_per_version.sh for it (confirmation still required at that
# level). If it exits 2 (halt), stops the loop immediately and exits 2.
# If it exits 3 ([C]hat), stops the loop immediately and exits 3.
# On [D], exits 0. On [C]hat (chosen directly at this level, before any
# version is picked), prints CHAT_CONTEXT= (empty — nothing selected
# yet) and exits 3.
#
# Exit code contract: 0 = done, 2 = halt (propagated from
# update_per_version.sh), 3 = [C]hat requested (either at this level,
# or propagated from update_per_version.sh).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_SCRIPT_DIR="$SCRIPT_DIR"

# shellcheck source=../_lib/repo_config.sh
source "${SCRIPT_DIR}/../_lib/repo_config.sh"
# shellcheck source=_pending_versions.sh
source "${SCRIPT_DIR}/_pending_versions.sh"

USAGE="Usage: $0 [--repo <path>]"

REPO_PATH="."
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO_PATH="${2:?$USAGE}"
      shift 2
      ;;
    *)
      echo "$USAGE" >&2
      exit 1
      ;;
  esac
done

CONFIG_FILE="${REPO_PATH}/.claude/configuration/arcanum-repo-config.json"
LOCAL_CONFIG_FILE="${REPO_PATH}/.claude/state/arcanum-config.json"

while true; do
  CURRENT_VERSION="$(repo_config_get_version "$CONFIG_FILE")"
  CURRENT_VERSION="${CURRENT_VERSION:-0.0.0}"
  CURRENT_LOCAL_VERSION="$(repo_config_get_version "$LOCAL_CONFIG_FILE" migrations)"
  CURRENT_LOCAL_VERSION="${CURRENT_LOCAL_VERSION:-0.0.0}"

  PENDING=()
  while IFS= read -r v; do
    [[ -n "$v" ]] && PENDING+=("$v")
  done < <(_pending_versions "$CURRENT_VERSION" "$CURRENT_LOCAL_VERSION")

  echo "Pending versions:"
  for v in "${PENDING[@]+"${PENDING[@]}"}"; do
    echo "  $v"
  done

  if ! ( exec 3< /dev/tty ) 2>/dev/null; then
    echo "Error: no interactive terminal (/dev/tty) available to prompt for a version selection. Run this from a real terminal." >&2
    exit 1
  fi
  printf 'Select a version, [D]one, or [C]hat: '
  read -r choice < /dev/tty

  case "$choice" in
    [Dd]*|"")
      exit 0
      ;;
    [Cc]*)
      echo "CHAT_CONTEXT="
      exit 3
      ;;
    *)
      rc=0
      "${SCRIPT_DIR}/update_per_version.sh" "$choice" --repo "$REPO_PATH" || rc=$?
      [[ "$rc" -eq 2 ]] && exit 2
      [[ "$rc" -eq 3 ]] && exit 3
      ;;
  esac
done
