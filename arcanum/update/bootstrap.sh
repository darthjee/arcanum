#!/usr/bin/env bash
# Minimal curl | bash entry point for updating an existing arcanum install.
# Usage:
#   bash <install-dir>/arcanum/update/bootstrap.sh                       # already installed
#   curl -fsSL <raw-url-of-this-file-on-main> | bash                     # fresh curl
#
# Mirrors arcanum/install/bootstrap.sh's shape (kept small — this is the
# only part of the update flow executed blindly when piped straight into
# bash), with these differences:
#   1. Version resolution falls back to the latest published GitHub
#      release instead of a baked-in constant, since the local copy
#      invoking this could be arbitrarily old.
#   2. Target/repo/install-method are pre-resolved here, before doing
#      anything else, using this script's own on-disk location as a
#      signal.
#   3. For a zip-tracked install (arcanum.json present), hands off to
#      arcanum/update/updater.sh instead of installer.sh. For a
#      git-clone install (.git present, no arcanum.json), the update is
#      applied directly here via `git fetch`/`git checkout` — updater.sh
#      is never invoked for that path.
#   4. Prints a resolved-repo/version/method confirmation and requires
#      an explicit y/N before doing anything that touches the network or
#      the target (bypassable via ARCANUM_ASSUME_YES).
#
# REPO/VERSION/TARGET/ORIG_PWD are exported so updater.sh (execed below,
# zip path only) can read them.
#
# Env vars:
#   ARCANUM_REPO       GitHub "<owner>/<repo>" to update from. Default: same
#                      repo the install came from (read from arcanum.json
#                      for a zip install, or from `git remote get-url
#                      origin` for a git-clone install, when TARGET is
#                      known), else darthjee/arcanum.
#   ARCANUM_VERSION    Release tag to update to (e.g. "0.9.0"). Default:
#                      latest published release on ARCANUM_REPO.
#   ARCANUM_TARGET     Existing install directory to update. Only consulted
#                      when this script isn't running as a real on-disk file
#                      (i.e. piped via curl | bash). Ignored otherwise.
#   ARCANUM_ASSUME_YES Set (any non-empty value) to skip the trust-confirmation
#                      prompt below, e.g. for unattended/CI use. Meant as a
#                      one-off command prefix (ARCANUM_ASSUME_YES=1 bash
#                      bootstrap.sh), not something to export permanently.

set -euo pipefail

DEFAULT_REPO="darthjee/arcanum"
ORIG_PWD="$(pwd)"

# parse_github_owner_repo <target>
#   Echoes "<owner>/<repo>" parsed from <target>'s "origin" remote URL.
#   Supports git@github.com:owner/repo.git and https://github.com/owner/repo.git
#   forms (".git" suffix stripped either way). Returns nonzero if there's
#   no "origin" remote or its URL doesn't match either form.
parse_github_owner_repo() {
  local target="$1"
  local url
  url="$(git -C "$target" remote get-url origin 2>/dev/null)" || return 1
  url="${url%.git}"
  case "$url" in
    git@github.com:*)     echo "${url#git@github.com:}" ;;
    https://github.com/*) echo "${url#https://github.com/}" ;;
    *)                    return 1 ;;
  esac
}

# --- Resolve TARGET and detect install method (zip vs. git) ----------------

TARGET=""

if [[ -f "${BASH_SOURCE[0]}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  CANDIDATE_TARGET="$(cd "${SCRIPT_DIR}/../.." && pwd)"
  if [[ -f "${CANDIDATE_TARGET}/arcanum.json" || -d "${CANDIDATE_TARGET}/.git" ]]; then
    TARGET="$CANDIDATE_TARGET"
  fi
elif [[ -n "${ARCANUM_TARGET:-}" ]]; then
  TARGET="$ARCANUM_TARGET"
fi

METHOD=""
if [[ -n "$TARGET" ]]; then
  if [[ -f "${TARGET}/arcanum.json" ]]; then
    METHOD="zip"
  elif [[ -d "${TARGET}/.git" ]]; then
    METHOD="git"
  fi
fi

REPO_DEFAULT="$DEFAULT_REPO"
if [[ -n "$TARGET" && -z "${ARCANUM_REPO+x}" ]]; then
  if [[ "$METHOD" == "zip" ]]; then
    DETECTED_REPO="$(jq -r '.repo // empty' "${TARGET}/arcanum.json" 2>/dev/null || true)"
    [[ -n "$DETECTED_REPO" ]] && REPO_DEFAULT="$DETECTED_REPO"
  elif [[ "$METHOD" == "git" ]]; then
    DETECTED_REPO="$(parse_github_owner_repo "$TARGET" || true)"
    [[ -n "$DETECTED_REPO" ]] && REPO_DEFAULT="$DETECTED_REPO"
  fi
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

# --- Git-clone install: update directly, no updater.sh, no zip download ----

if [[ "$METHOD" == "git" ]]; then
  CURRENT_TAG="$(git -C "$TARGET" describe --tags --exact-match 2>/dev/null || true)"
  if [[ "$CURRENT_TAG" == "$VERSION" ]]; then
    echo "Already on ${VERSION}." >&2
    exit 0
  fi

  if [[ -n "$(git -C "$TARGET" status --porcelain)" ]]; then
    echo "Error: ${TARGET} has uncommitted changes." >&2
    echo "Commit, stash, or discard them, then re-run." >&2
    exit 1
  fi

  CURRENT_REF="$(git -C "$TARGET" rev-parse --abbrev-ref HEAD)"
  if [[ "$CURRENT_REF" == "HEAD" ]]; then
    CURRENT_REF="$(git -C "$TARGET" rev-parse --short HEAD)"
  fi

  if [[ -z "${ARCANUM_ASSUME_YES:-}" ]]; then
    echo "This will run 'git fetch'/'git checkout ${VERSION}' in ${TARGET} (currently on ${CURRENT_REF}) from remote ${REPO}." >&2
    printf "Proceed? [y/N]: " >&2
    read -r confirm < /dev/tty
    case "$confirm" in
      y|Y) ;;
      *)
        echo "Aborted: update not confirmed." >&2
        exit 1
        ;;
    esac
  fi

  git -C "$TARGET" fetch --tags --prune
  git -C "$TARGET" checkout "$VERSION"

  echo "arcanum updated to ${VERSION} at ${TARGET}" >&2
  exit 0
fi

# --- Zip-tracked install (or unresolved TARGET): existing download flow ----

export REPO
export VERSION
export TARGET
export ORIG_PWD

ASSET="arcanum-${VERSION}.zip"
URL="https://github.com/${REPO}/releases/download/${VERSION}/${ASSET}"

if [[ -z "${ARCANUM_ASSUME_YES:-}" ]]; then
  echo "This will download and execute a release zip from ${REPO} (version ${VERSION})." >&2
  echo "  URL: ${URL}" >&2
  if [[ -n "$TARGET" ]]; then
    echo "  Target: ${TARGET}" >&2
  fi
  printf "Proceed? [y/N]: " >&2
  read -r confirm < /dev/tty
  case "$confirm" in
    y|Y) ;;
    *)
      echo "Aborted: update not confirmed." >&2
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

exec "${WORK_DIR}/arcanum/update/updater.sh"
