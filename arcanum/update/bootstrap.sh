#!/usr/bin/env bash
# Minimal curl | bash entry point for updating an existing arcanum install.
# Usage:
#   bash <install-dir>/arcanum/update/bootstrap.sh                       # already installed
#   curl -fsSL <raw-url-of-this-file-on-main> | bash                     # fresh curl
#
# Mirrors arcanum/install/bootstrap.sh's shape (kept small — this is the
# only part of the update flow executed blindly when piped straight into
# bash), with three differences:
#   1. Version resolution falls back to the latest published GitHub
#      release instead of a baked-in constant, since the local copy
#      invoking this could be arbitrarily old.
#   2. Target/repo are pre-resolved here, before downloading, using this
#      script's own on-disk location as a signal.
#   3. Hands off to arcanum/update/updater.sh instead of installer.sh.
#
# REPO/VERSION/TARGET are exported so updater.sh (execed below) can read
# them.
#
# Env vars:
#   ARCANUM_REPO    GitHub "<owner>/<repo>" to update from. Default: same
#                   repo the install came from (read from arcanum.json
#                   when TARGET is known), else darthjee/arcanum.
#   ARCANUM_VERSION Release tag to update to (e.g. "0.9.0"). Default:
#                   latest published release on ARCANUM_REPO.
#   ARCANUM_TARGET  Existing install directory to update. Only consulted
#                   when this script isn't running as a real on-disk file
#                   (i.e. piped via curl | bash). Ignored otherwise.

set -euo pipefail

DEFAULT_REPO="darthjee/arcanum"

# --- Resolve TARGET and, from it, a repo-aware default for REPO -----------

TARGET=""

if [[ -f "${BASH_SOURCE[0]}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  CANDIDATE_TARGET="$(cd "${SCRIPT_DIR}/../.." && pwd)"
  [[ -f "${CANDIDATE_TARGET}/arcanum.json" ]] && TARGET="$CANDIDATE_TARGET"
elif [[ -n "${ARCANUM_TARGET:-}" ]]; then
  TARGET="$ARCANUM_TARGET"
fi

REPO_DEFAULT="$DEFAULT_REPO"
if [[ -n "$TARGET" && -z "${ARCANUM_REPO+x}" && -f "${TARGET}/arcanum.json" ]]; then
  DETECTED_REPO="$(jq -r '.repo // empty' "${TARGET}/arcanum.json" 2>/dev/null || true)"
  [[ -n "$DETECTED_REPO" ]] && REPO_DEFAULT="$DETECTED_REPO"
fi

REPO="${ARCANUM_REPO:-$REPO_DEFAULT}"

# --- Resolve VERSION --------------------------------------------------------

if [[ -n "${ARCANUM_VERSION:-}" ]]; then
  VERSION="$ARCANUM_VERSION"
else
  echo "Resolving latest release of ${REPO}..." >&2
  LATEST_JSON="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest")" || {
    echo "Error: failed to resolve the latest release for ${REPO}." >&2
    echo "Set ARCANUM_VERSION explicitly to skip this lookup." >&2
    exit 1
  }
  VERSION="$(echo "$LATEST_JSON" | grep '"tag_name"' | head -1 | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')"
  [[ -n "$VERSION" ]] || {
    echo "Error: could not parse a tag_name from the latest release of ${REPO}." >&2
    exit 1
  }
fi

export REPO
export VERSION
export TARGET

ASSET="arcanum-${VERSION}.zip"
URL="https://github.com/${REPO}/releases/download/${VERSION}/${ASSET}"

WORK_DIR="$(mktemp -d)"

echo "Downloading arcanum ${VERSION} from ${REPO}..." >&2
if ! curl -fsSL -o "${WORK_DIR}/${ASSET}" "$URL"; then
  echo "Error: failed to download ${URL}" >&2
  echo "Check that ARCANUM_REPO (${REPO}) and ARCANUM_VERSION (${VERSION}) are correct." >&2
  exit 1
fi

unzip -q "${WORK_DIR}/${ASSET}" -d "${WORK_DIR}"

exec "${WORK_DIR}/arcanum/update/updater.sh"
