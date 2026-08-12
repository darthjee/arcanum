#!/usr/bin/env bash
# Run (or offer to run) every migration file for a single version.
# Usage: update_per_version.sh <version> [--no-confirm]
#
# Lists arcanum/migrations/repos/<version>/*.sh (3-digit zero-padded
# names) sorted numerically by filename.
#
# With --no-confirm: runs update_per_file.sh <version> <file>
# --no-confirm for each file in order; if any call exits 2 (halt), stops
# immediately and exits 2 without running the remaining files.
#
# Without --no-confirm: prints the file list (basenames), then prompts
# (via /dev/tty) [A]ll/[N]one/[S]elect:
#   [A]ll     -> same as the --no-confirm loop above (stop + exit 2 on
#                first halt).
#   [N]one    -> exits 0, nothing runs.
#   [S]elect  -> for each file in order, calls
#                update_per_file.sh <version> <file> (no --no-confirm,
#                so it does its own [R]un/[S]kip prompt per file); if
#                any call exits 2, stops immediately and exits 2.
#
# All-files-processed-without-halt: exits 0.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UPDATE_PER_FILE="${SCRIPT_DIR}/update_per_file.sh"

VERSION="${1:?Usage: $0 <version> [--no-confirm]}"
NO_CONFIRM=false
[[ "${2:-}" == "--no-confirm" ]] && NO_CONFIRM=true

VERSION_DIR="${SCRIPT_DIR}/repos/${VERSION}"

FILES=()
if [[ -d "$VERSION_DIR" ]]; then
  while IFS= read -r f; do
    FILES+=("$f")
  done < <(find "$VERSION_DIR" -maxdepth 1 -name '[0-9][0-9][0-9].sh' | sort)
fi

if [[ "$NO_CONFIRM" == true ]]; then
  for f in "${FILES[@]}"; do
    rc=0
    "$UPDATE_PER_FILE" "$VERSION" "$f" --no-confirm || rc=$?
    [[ "$rc" -eq 2 ]] && exit 2
  done
  exit 0
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No migrations for version ${VERSION}."
  exit 0
fi

echo "Migrations for version ${VERSION}:"
for f in "${FILES[@]}"; do
  echo "  $(basename "$f")"
done

printf '[A]ll/[N]one/[S]elect: '
read -r choice < /dev/tty

case "$choice" in
  [Aa]*)
    for f in "${FILES[@]}"; do
      rc=0
      "$UPDATE_PER_FILE" "$VERSION" "$f" --no-confirm || rc=$?
      [[ "$rc" -eq 2 ]] && exit 2
    done
    ;;
  [Ss]*)
    for f in "${FILES[@]}"; do
      rc=0
      "$UPDATE_PER_FILE" "$VERSION" "$f" || rc=$?
      [[ "$rc" -eq 2 ]] && exit 2
    done
    ;;
  *)
    exit 0
    ;;
esac

exit 0
