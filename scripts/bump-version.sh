#!/usr/bin/env bash
# Bump arcanum's version.
# Usage: bump-version.sh [new-version]
#
# Updates arcanum.version at the repo root, the baked-in default version
# constant inside arcanum/install/bootstrap.sh (DEFAULT_VERSION), and the
# "Current Version" / "Next Release" lines in README.md. Also rolls
# arcanum/migrations/repos/next/ (pending, unreleased per-repo migrations)
# into arcanum/migrations/repos/<new-version>/, and recreates an empty
# next/ (with a .keep placeholder) in its place, so a migration always
# ships in the same release as the change it belongs to. Also regenerates
# docs/agents/tag-mutations.md (scripts/generate_tags_table.sh, default
# non-interactive mode), so it self-heals at every release even if nobody
# ran it manually mid-cycle.
# Does NOT commit or tag anything — that remains a separate, manual (or
# future) step.
#
# If <new-version> is omitted, it defaults to a patch bump (X.Y.Z+1) of
# the version currently in arcanum.version.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

VERSION_FILE="${REPO_ROOT}/arcanum.version"
BOOTSTRAP_FILE="${REPO_ROOT}/arcanum/install/bootstrap.sh"
README_FILE="${REPO_ROOT}/README.md"
MIGRATIONS_REPOS_DIR="${REPO_ROOT}/arcanum/migrations/repos"
REPO_SLUG="darthjee/arcanum"

NEW_VERSION="${1:-}"

if [[ -z "$NEW_VERSION" ]]; then
  CURRENT_VERSION="$(cat "$VERSION_FILE")"
  if ! [[ "$CURRENT_VERSION" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    echo "Error: current version in ${VERSION_FILE} is not valid semver: ${CURRENT_VERSION}" >&2
    exit 1
  fi
  NEW_VERSION="${BASH_REMATCH[1]}.${BASH_REMATCH[2]}.$((BASH_REMATCH[3] + 1))"
fi

if ! [[ "$NEW_VERSION" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  echo "Error: <new-version> must look like semver X.Y.Z (no 'v' prefix), got: ${NEW_VERSION}" >&2
  exit 1
fi

NEXT_RELEASE="${BASH_REMATCH[1]}.${BASH_REMATCH[2]}.$((BASH_REMATCH[3] + 1))"

echo "$NEW_VERSION" > "$VERSION_FILE"

sed -i.bak -E "s/^DEFAULT_VERSION=\"[^\"]*\"/DEFAULT_VERSION=\"${NEW_VERSION}\"/" "$BOOTSTRAP_FILE"
rm -f "${BOOTSTRAP_FILE}.bak"

"${SCRIPT_DIR}/generate_tags_table.sh"

sed -i.bak -E \
  "s#\*\*Current Version:\*\* \[[0-9]+\.[0-9]+\.[0-9]+\]\(https://github.com/${REPO_SLUG}/releases/tag/[0-9]+\.[0-9]+\.[0-9]+\)#**Current Version:** [${NEW_VERSION}](https://github.com/${REPO_SLUG}/releases/tag/${NEW_VERSION})#" \
  "$README_FILE"
sed -i.bak -E \
  "s#\*\*Next Release:\*\* \[[0-9]+\.[0-9]+\.[0-9]+\]\(https://github.com/${REPO_SLUG}/compare/[0-9]+\.[0-9]+\.[0-9]+\.\.\.main\)#**Next Release:** [${NEXT_RELEASE}](https://github.com/${REPO_SLUG}/compare/${NEW_VERSION}...main)#" \
  "$README_FILE"
rm -f "${README_FILE}.bak"

NEXT_MIGRATIONS_DIR="${MIGRATIONS_REPOS_DIR}/next"
VERSION_MIGRATIONS_DIR="${MIGRATIONS_REPOS_DIR}/${NEW_VERSION}"

is_migrations_dir_empty() {
  local dir="$1"
  [[ -z "$(find "$dir" -mindepth 1 ! -name '.keep')" ]]
}

if [[ -d "$VERSION_MIGRATIONS_DIR" ]]; then
  echo "Error: ${VERSION_MIGRATIONS_DIR} already exists — refusing to overwrite." >&2
  exit 1
fi
if [[ ! -d "$NEXT_MIGRATIONS_DIR" ]]; then
  echo "Error: ${NEXT_MIGRATIONS_DIR} is missing — expected it to always exist." >&2
  exit 1
fi

echo "New version:  ${NEW_VERSION}"
echo "Next release: ${NEXT_RELEASE}"
echo "Updated ${VERSION_FILE}, ${BOOTSTRAP_FILE}, ${README_FILE}, and docs/agents/tag-mutations.md."

if is_migrations_dir_empty "$NEXT_MIGRATIONS_DIR"; then
  touch "${NEXT_MIGRATIONS_DIR}/.keep"   # defensive: keep it git-trackable even if .keep was missing
  echo "No pending migrations in ${NEXT_MIGRATIONS_DIR} — skipping rename."
else
  mv "$NEXT_MIGRATIONS_DIR" "$VERSION_MIGRATIONS_DIR"
  mkdir -p "$NEXT_MIGRATIONS_DIR"
  touch "${NEXT_MIGRATIONS_DIR}/.keep"
  echo "Moved ${NEXT_MIGRATIONS_DIR} -> ${VERSION_MIGRATIONS_DIR} and recreated an empty ${NEXT_MIGRATIONS_DIR}."
fi
