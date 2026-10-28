#!/usr/bin/env bash
# Updater stage — ships inside the release zip (and alongside
# bootstrap.sh in a full git clone). Reconciles an existing arcanum
# install with this release: adds new files, replaces changed ones
# (unlinking the old file first, so scripts still running from the
# install keep their old inode), deletes files no longer part of the
# release, updates arcanum.json to record the new version/repo/manifest,
# and ends with the client step:
# installs or updates arcanum-cli@$VERSION through the installed copy of
# arcanum/_lib/install_cli.sh (docs/agents/architecture/cli-install.md,
# "Callers" -> "Zip updater").
# ARCANUM_CLI_PROMPT and ARCANUM_SKIP_CLI reach that step unchanged.
#
# Not meant to be curl | bash'd directly: bootstrap.sh execs this from
# inside the unzipped release tree, so relative paths resolve correctly.
# Requires REPO/VERSION to be set in the environment (bootstrap.sh
# exports both before exec'ing here) and jq to be installed. TARGET may
# also be set (bootstrap.sh pre-resolves it when possible); if empty,
# this script prompts interactively. ORIG_PWD, when set (bootstrap.sh
# exports it), is the caller's working directory to restore on exit —
# a safe no-op if unset (e.g. this script invoked directly).
#
# Usage: arcanum/update/updater.sh   (no arguments)
#
# Exit codes:
#   0  updated, or already on the version (no client step then)
#   1  aborted target, missing install, or lock held
#   4  opt-in chat fallback from the client step (ARCANUM_CLI_PROMPT=chat):
#      FALLBACK=chat / CLI_VERSION= / CLI_INSTALLED= lines on stdout; the
#      arcanum update itself is already complete

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
WORK_DIR="$RELEASE_ROOT"
LOCK_DIR=""

cleanup() {
  cd "${ORIG_PWD:-.}" 2>/dev/null || true
  [[ -n "$LOCK_DIR" ]] && rmdir "$LOCK_DIR" 2>/dev/null || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

: "${REPO:?REPO must be set (exported by bootstrap.sh)}"
: "${VERSION:?VERSION must be set (exported by bootstrap.sh)}"

DEFAULT_TARGET="${HOME}/.claude/skills"

expand_path() {
  local path="$1"
  case "$path" in
    "~") echo "$HOME" ;;
    "~/"*) echo "${HOME}/${path#\~/}" ;;
    *) echo "$path" ;;
  esac
}

TARGET="${TARGET:-}"

if [[ -z "$TARGET" ]]; then
  echo "Which arcanum install should be updated?" >&2
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
      echo "Aborted: update not confirmed." >&2
      exit 1
    fi
  fi
fi

if [[ ! -f "${TARGET}/arcanum.json" ]]; then
  echo "Error: no arcanum install found at ${TARGET} (missing arcanum.json)." >&2
  echo "Run the install script instead: bash ${RELEASE_ROOT}/arcanum/install/installer.sh" >&2
  exit 1
fi

OLD_VERSION="$(jq -r '.version // empty' "${TARGET}/arcanum.json")"
OLD_MANIFEST=()
while IFS= read -r manifest_entry; do
  [[ -n "$manifest_entry" ]] && OLD_MANIFEST+=("$manifest_entry")
done < <(jq -r '.manifest[]? // empty' "${TARGET}/arcanum.json")

if [[ "$VERSION" == "$OLD_VERSION" ]]; then
  echo "Already on ${VERSION}." >&2
  exit 0
fi

# --- Acquire the concurrency lock -------------------------------------------
#
# Atomic (mkdir either succeeds or it doesn't — no read-modify-write race
# window), and deliberately a separate directory rather than a field inside
# arcanum.json (which is written last, on purpose, for safe retryability).

if ! mkdir "${TARGET}/.arcanum-update.lock" 2>/dev/null; then
  echo "An update is already running for this install. If you're sure this is stale from a crashed run, remove ${TARGET}/.arcanum-update.lock and retry." >&2
  exit 1
fi
LOCK_DIR="${TARGET}/.arcanum-update.lock"

# --- Add/update: same one-shot copy install uses ---------------------------
#
# Unlink files the release replaces before copying: cp rewrites an
# existing file in place (same inode), so a script still running from the
# install (e.g. arcanum-update/scripts/run_update.sh) would read the new
# content at its stale byte offset. Removed first, the copy gets a new
# inode and the running bash keeps reading the old, unlinked one.

while IFS= read -r -d '' rel_path; do
  rel_path="${rel_path#./}"
  if [[ -f "${TARGET}/${rel_path}" || -L "${TARGET}/${rel_path}" ]]; then
    rm -f "${TARGET}/${rel_path}"
  fi
done < <(cd "$RELEASE_ROOT" && find . \( -type f -o -type l \) -print0)

cp -R "${RELEASE_ROOT}/." "${TARGET}/"

# --- Compute and apply the delete set ---------------------------------------
#
# Path-traversal safety: manifest entries ultimately originate from a
# downloaded release's MANIFEST file. Reject anything absolute or
# containing a ".." segment outright, and confirm the resolved real path
# still lives strictly inside TARGET before ever calling rm.

TARGET_REAL="$(cd "$TARGET" && pwd)"

if ((${#OLD_MANIFEST[@]} > 0)); then
  while IFS= read -r rel_path; do
    [[ -z "$rel_path" ]] && continue

    if [[ "$rel_path" = /* || "$rel_path" == *..* ]]; then
      echo "Warning: skipping suspicious manifest entry: ${rel_path}" >&2
      continue
    fi

    # Resolve the real (symlink-free) physical path without relying on
    # GNU-only `realpath -m` (not available on macOS's BSD realpath, and
    # the target file is expected gone-or-going anyway): resolve the
    # containing directory via `cd`/`pwd`, then re-append the filename.
    # A directory that no longer exists means there's nothing to delete.
    dir_part="$(dirname "$rel_path")"
    base_part="$(basename "$rel_path")"
    resolved_dir="$(cd "${TARGET_REAL}/${dir_part}" 2>/dev/null && pwd)" || continue
    real_path="${resolved_dir}/${base_part}"

    case "$real_path" in
      "${TARGET_REAL}/"*) rm -f "$real_path" ;;
      *)
        echo "Warning: skipping manifest entry resolving outside target: ${rel_path}" >&2
        ;;
    esac
  done < <(comm -23 <(printf '%s\n' "${OLD_MANIFEST[@]}" | sort) <(sort "${RELEASE_ROOT}/MANIFEST"))
fi

# --- Write arcanum.json last: makes a partial failure safely retryable ------

MANIFEST_JSON="$(jq -R . "${RELEASE_ROOT}/MANIFEST" | jq -s .)"
jq -n --arg version "$VERSION" --arg repo "$REPO" --argjson manifest "$MANIFEST_JSON" \
  '{version: $version, repo: $repo, manifest: $manifest}' > "${TARGET}/arcanum.json"

echo "arcanum updated to ${VERSION} at ${TARGET}" >&2

# Client step (docs/agents/architecture/cli-install.md, "Callers" -> "Zip
# updater"): installs or updates arcanum-cli@$VERSION from the installed
# tree, so the script outlives cleanup. Never fails the update: only the opt-in exit 4
# (ARCANUM_CLI_PROMPT=chat, set by /arcanum-update) is propagated, with
# its FALLBACK=chat stdout lines; any other status is ignored.
cli_status=0
"${TARGET}/arcanum/_lib/install_cli.sh" "$VERSION" || cli_status=$?
if [[ "$cli_status" -eq 4 ]]; then
  exit 4
fi
