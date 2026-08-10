#!/usr/bin/env bash
# Updater stage — ships inside the release zip (and alongside
# bootstrap.sh in a full git clone). Reconciles an existing arcanum
# install with this release: adds new files, overwrites changed ones,
# deletes files no longer part of the release, then updates
# arcanum.json to record the new version/repo/manifest.
#
# Not meant to be curl | bash'd directly: bootstrap.sh execs this from
# inside the unzipped release tree, so relative paths resolve correctly.
# Requires REPO/VERSION to be set in the environment (bootstrap.sh
# exports both before exec'ing here) and jq to be installed. TARGET may
# also be set (bootstrap.sh pre-resolves it when possible); if empty,
# this script prompts interactively.
#
# Usage: arcanum/update/updater.sh   (no arguments)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
WORK_DIR="$RELEASE_ROOT"

trap 'rm -rf "$WORK_DIR"' EXIT

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

# --- Add/update: same one-shot copy install uses ---------------------------

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
