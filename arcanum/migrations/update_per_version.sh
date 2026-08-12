#!/usr/bin/env bash
# Run (or offer to run) every migration file for a single version.
# Usage: update_per_version.sh <version> [--no-confirm] [--repo <path>]
#
# --repo <path> is optional, trailing (after <version>, in any order
# relative to --no-confirm), and defaults to "." (today's cwd-relative
# behavior, unchanged). Forwarded verbatim into every
# update_per_file.sh call this script makes. The arcanum install
# location itself (SCRIPT_DIR, derived from BASH_SOURCE) is never
# affected by --repo.
#
# Lists arcanum/migrations/repos/<version>/*.sh (3-digit zero-padded
# names) sorted numerically by filename.
#
# With --no-confirm: runs update_per_file.sh <version> <file>
# --no-confirm for each file in order; if any call exits 2 (halt), stops
# immediately and exits 2 without running the remaining files.
#
# Without --no-confirm: prints the file list (basenames), verifies
# /dev/tty is actually open/readable (failing fast to stderr, exit 1,
# if not), then prompts (via /dev/tty)
# [A]ll/[N]one/[S]elect/[C]hat:
#   [A]ll     -> same as the --no-confirm loop above (stop + exit 2 on
#                first halt, or exit 3 immediately if a file requests
#                [C]hat).
#   [N]one    -> exits 0, nothing runs.
#   [S]elect  -> for each file in order, calls
#                update_per_file.sh <version> <file> (no --no-confirm,
#                so it does its own [R]un/[S]kip/[C]hat prompt per
#                file); if any call exits 2, stops immediately and
#                exits 2; if any call exits 3 ([C]hat), stops
#                immediately and exits 3.
#   [C]hat    -> prints CHAT_CONTEXT=<version> and exits 3 immediately
#                (no file has been touched yet at this point).
#
# All-files-processed-without-halt-or-chat: exits 0.
#
# Exit code contract: 0 = completed (or [N]one chosen), 2 = halt
# (propagated from update_per_file.sh), 3 = [C]hat requested (either
# at this level, or propagated from update_per_file.sh).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UPDATE_PER_FILE="${SCRIPT_DIR}/update_per_file.sh"

USAGE="Usage: $0 <version> [--no-confirm] [--repo <path>]"

VERSION="${1:?$USAGE}"
shift

NO_CONFIRM=false
REPO_PATH="."
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-confirm)
      NO_CONFIRM=true
      shift
      ;;
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

VERSION_DIR="${SCRIPT_DIR}/repos/${VERSION}"

FILES=()
if [[ -d "$VERSION_DIR" ]]; then
  while IFS= read -r f; do
    FILES+=("$f")
  done < <(find "$VERSION_DIR" -maxdepth 1 -name '[0-9][0-9][0-9].sh' | sort)
fi

if [[ "$NO_CONFIRM" == true ]]; then
  for f in "${FILES[@]+"${FILES[@]}"}"; do
    rc=0
    "$UPDATE_PER_FILE" "$VERSION" "$f" --no-confirm --repo "$REPO_PATH" || rc=$?
    [[ "$rc" -eq 2 ]] && exit 2
    [[ "$rc" -eq 3 ]] && exit 3
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

if ! ( exec 3< /dev/tty ) 2>/dev/null; then
  echo "Error: no interactive terminal (/dev/tty) available to prompt for [A]ll/[N]one/[S]elect/[C]hat. Pass --no-confirm, or run this from a real terminal." >&2
  exit 1
fi
printf '[A]ll/[N]one/[S]elect/[C]hat: '
read -r choice < /dev/tty

case "$choice" in
  [Aa]*)
    for f in "${FILES[@]}"; do
      rc=0
      "$UPDATE_PER_FILE" "$VERSION" "$f" --no-confirm --repo "$REPO_PATH" || rc=$?
      [[ "$rc" -eq 2 ]] && exit 2
      [[ "$rc" -eq 3 ]] && exit 3
    done
    ;;
  [Ss]*)
    for f in "${FILES[@]}"; do
      rc=0
      "$UPDATE_PER_FILE" "$VERSION" "$f" --repo "$REPO_PATH" || rc=$?
      [[ "$rc" -eq 2 ]] && exit 2
      [[ "$rc" -eq 3 ]] && exit 3
    done
    ;;
  [Cc]*)
    echo "CHAT_CONTEXT=${VERSION}"
    exit 3
    ;;
  *)
    exit 0
    ;;
esac

exit 0
