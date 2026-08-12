#!/usr/bin/env bash
# Build the trimmed release zip published as a GitHub Release asset.
# Usage: build_release_zip.sh [output_dir]
#
# Dev-only tooling — this script (and the rest of this top-level scripts/
# folder) is NOT itself shipped inside the zip it produces, unlike
# arcanum/install/ which is.
#
# Reads the version from arcanum.version at the repo root and packages
# every git-tracked file except the dev-only paths listed in EXCLUDES
# (skill folders and arcanum/ pass through untouched; arcanum.version
# itself is excluded — installs no longer read a shipped copy of it,
# see arcanum/install/installer.sh). "docs/" is excluded except for
# "docs/guides/" (packaged user-facing guides, e.g. linked from
# arcanum/_lib/repo_config.sh's fallback warning) — every other doc
# under docs/ stays dev-only and unshipped. Also embeds a MANIFEST file
# at the zip root, listing every packaged path one per line, so
# installer.sh/updater.sh can reconcile an install without needing git.
# Prints the absolute path of the produced zip as the last line of
# stdout.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

OUTPUT_DIR="${1:-dist}"
[[ "$OUTPUT_DIR" = /* ]] || OUTPUT_DIR="${REPO_ROOT}/${OUTPUT_DIR}"

VERSION="$(tr -d '[:space:]' < "${REPO_ROOT}/arcanum.version")"

EXCLUDES=(
  "AGENTS.md"
  "CLAUDE.md"
  ".claude/"
  "docs/"
  ".github/"
  "ISSUE_TEMPLATE.md"
  ".gitignore"
  "scripts/"
  "arcanum.version"
)

is_excluded() {
  local path="$1"
  local exclude
  for exclude in "${EXCLUDES[@]}"; do
    if [[ "$exclude" == "docs/" ]]; then
      # Carve-out: docs/ is excluded wholesale except docs/guides/,
      # which is packaged (see header comment above).
      [[ "$path" == docs/* && "$path" != docs/guides/* ]] && return 0
    elif [[ "$exclude" == */ ]]; then
      [[ "$path" == "$exclude"* ]] && return 0
    else
      [[ "$path" == "$exclude" ]] && return 0
    fi
  done
  return 1
}

mkdir -p "$OUTPUT_DIR"
ZIP_PATH="${OUTPUT_DIR}/arcanum-${VERSION}.zip"
rm -f "$ZIP_PATH"

cd "$REPO_ROOT"

FILES=()
while IFS= read -r path; do
  is_excluded "$path" || FILES+=("$path")
done < <(git ls-files)

zip -q "$ZIP_PATH" "${FILES[@]}"

MANIFEST_PATH="${OUTPUT_DIR}/MANIFEST"
printf '%s\n' "${FILES[@]}" > "$MANIFEST_PATH"
zip -j -q "$ZIP_PATH" "$MANIFEST_PATH"
rm -f "$MANIFEST_PATH"

echo "$ZIP_PATH"
