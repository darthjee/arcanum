#!/usr/bin/env bash
# Minimal curl | bash entry point for installing arcanum.
# Usage: curl -fsSL <raw-url-of-this-file-on-main> | bash
#
# Kept deliberately small — this is the only part of the install flow
# executed blindly (piped straight into bash). It resolves a version,
# downloads that release's trimmed zip, unzips it, and hands off to the
# heavier, versioned installer bundled inside the zip. Nothing else.
#
# REPO/VERSION are exported so installer.sh (execed below) can read them
# to write arcanum.json.
#
# Env vars:
#   ARCANUM_REPO       GitHub "<owner>/<repo>" to install from. Default: darthjee/arcanum
#   ARCANUM_VERSION    Release tag to install (e.g. "0.8.1"). Default: DEFAULT_VERSION below,
#                      kept in sync at release time by scripts/bump-version.sh.
#   ARCANUM_ASSUME_YES Set (any non-empty value) to skip the trust-confirmation
#                      prompt below, e.g. for unattended/CI use. Meant as a
#                      one-off command prefix (ARCANUM_ASSUME_YES=1 bash
#                      bootstrap.sh), not something to export permanently.

set -euo pipefail

DEFAULT_VERSION="0.19.3"

REPO="${ARCANUM_REPO:-darthjee/arcanum}"
VERSION="${ARCANUM_VERSION:-$DEFAULT_VERSION}"
export REPO
export VERSION

ASSET="arcanum-${VERSION}.zip"
URL="https://github.com/${REPO}/releases/download/${VERSION}/${ASSET}"

if [[ -z "${ARCANUM_ASSUME_YES:-}" ]]; then
  echo "This will download and execute a release zip from ${REPO} (version ${VERSION})." >&2
  echo "  URL: ${URL}" >&2
  printf "Proceed? [y/N]: " >&2
  read -r confirm < /dev/tty
  case "$confirm" in
    y|Y) ;;
    *)
      echo "Aborted: install not confirmed." >&2
      exit 1
      ;;
  esac
fi

WORK_DIR="$(mktemp -d)"

echo "Downloading arcanum ${VERSION} from ${REPO}..." >&2
if ! curl -fsSL -o "${WORK_DIR}/${ASSET}" "$URL"; then
  echo "Error: failed to download ${URL}" >&2
  echo "Check that ARCANUM_REPO (${REPO}) and ARCANUM_VERSION (${VERSION}) are correct." >&2
  exit 1
fi

unzip -q "${WORK_DIR}/${ASSET}" -d "${WORK_DIR}"

exec "${WORK_DIR}/arcanum/install/installer.sh"
