#!/usr/bin/env bash
# Installer stage — ships inside the release zip (and alongside
# bootstrap.sh in a full git clone). Prompts for a target directory and
# places the unzipped release tree there.
#
# Not meant to be curl | bash'd directly: bootstrap.sh execs this from
# inside the unzipped release tree, so relative paths resolve correctly.
#
# Usage: arcanum/install/installer.sh   (no arguments)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

DEFAULT_TARGET="${HOME}/.claude/skills"

expand_path() {
  local path="$1"
  case "$path" in
    "~") echo "$HOME" ;;
    "~/"*) echo "${HOME}/${path#\~/}" ;;
    *) echo "$path" ;;
  esac
}

echo "Where should arcanum be installed?" >&2
echo "  Press Enter to use the default (${DEFAULT_TARGET})," >&2
echo "  or type '.' for the current folder, or a custom path." >&2
printf "Target directory [%s]: " "$DEFAULT_TARGET" >&2
read -r input < /dev/tty

if [[ -z "$input" ]]; then
  TARGET="$DEFAULT_TARGET"
else
  TARGET="$(expand_path "$input")"
fi

if [[ "$TARGET" != "$DEFAULT_TARGET" ]]; then
  echo "You chose: ${TARGET}" >&2
  printf "Press Enter to confirm, or anything else to abort: " >&2
  read -r confirm < /dev/tty
  if [[ -n "$confirm" ]]; then
    echo "Aborted: installation not confirmed." >&2
    exit 1
  fi
fi

if [[ -f "${TARGET}/arcanum.version" ]]; then
  echo "Error: an arcanum install already exists at ${TARGET} (found arcanum.version)." >&2
  echo "This script does not support updates yet — remove the existing install manually first." >&2
  exit 1
fi

mkdir -p "$TARGET"
cp -R "${RELEASE_ROOT}/." "$TARGET/"

echo "arcanum installed to ${TARGET}" >&2
