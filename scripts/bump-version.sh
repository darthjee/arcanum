#!/usr/bin/env bash
# Bump arcanum's version.
# Usage: bump-version.sh <new-version>
#
# Updates arcanum.version at the repo root and the baked-in default
# version constant inside arcanum/install/bootstrap.sh (DEFAULT_VERSION).
# Does NOT commit or tag anything — that remains a separate, manual (or
# future) step.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

NEW_VERSION="${1:-}"

[[ -n "$NEW_VERSION" ]] || {
  echo "Usage: $0 <new-version>" >&2
  exit 1
}

if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: <new-version> must look like semver X.Y.Z (no 'v' prefix), got: ${NEW_VERSION}" >&2
  exit 1
fi

VERSION_FILE="${REPO_ROOT}/arcanum.version"
BOOTSTRAP_FILE="${REPO_ROOT}/arcanum/install/bootstrap.sh"

echo "$NEW_VERSION" > "$VERSION_FILE"
sed -i.bak -E "s/^DEFAULT_VERSION=\"[^\"]*\"/DEFAULT_VERSION=\"${NEW_VERSION}\"/" "$BOOTSTRAP_FILE"
rm -f "${BOOTSTRAP_FILE}.bak"

echo "Updated ${VERSION_FILE} and ${BOOTSTRAP_FILE} to version ${NEW_VERSION}."
