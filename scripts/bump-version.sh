#!/usr/bin/env bash
# Bump arcanum's version.
# Usage: bump-version.sh [new-version]
#
# Updates arcanum.version at the repo root and the baked-in default
# version constant inside arcanum/install/bootstrap.sh (DEFAULT_VERSION).
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

NEW_VERSION="${1:-}"

if [[ -z "$NEW_VERSION" ]]; then
  CURRENT_VERSION="$(cat "$VERSION_FILE")"
  if ! [[ "$CURRENT_VERSION" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    echo "Error: current version in ${VERSION_FILE} is not valid semver: ${CURRENT_VERSION}" >&2
    exit 1
  fi
  NEW_VERSION="${BASH_REMATCH[1]}.${BASH_REMATCH[2]}.$((BASH_REMATCH[3] + 1))"
fi

if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: <new-version> must look like semver X.Y.Z (no 'v' prefix), got: ${NEW_VERSION}" >&2
  exit 1
fi

echo "$NEW_VERSION" > "$VERSION_FILE"
sed -i.bak -E "s/^DEFAULT_VERSION=\"[^\"]*\"/DEFAULT_VERSION=\"${NEW_VERSION}\"/" "$BOOTSTRAP_FILE"
rm -f "${BOOTSTRAP_FILE}.bak"

echo "Updated ${VERSION_FILE} and ${BOOTSTRAP_FILE} to version ${NEW_VERSION}."
