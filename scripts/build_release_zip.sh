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
# (skill folders, arcanum/, and arcanum.version itself all pass through
# untouched). Prints the absolute path of the produced zip as the last
# line of stdout.

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
)

is_excluded() {
  local path="$1"
  local exclude
  for exclude in "${EXCLUDES[@]}"; do
    if [[ "$exclude" == */ ]]; then
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

echo "$ZIP_PATH"
