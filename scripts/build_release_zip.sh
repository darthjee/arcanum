#!/usr/bin/env bash
# Build the trimmed release zip published as a GitHub Release asset.
# Usage: build_release_zip.sh [--list] [output_dir]
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
# under docs/ stays dev-only and unshipped. The spec folders
# ("core/spec/", "shared/spec/") are dev-only too and never shipped,
# as are CI, lint and test tooling config (".circleci/", the lint
# configs, the root Makefile, core/docker-compose.yml, the
# arcanum-next-step mod's tests and tsconfig.json) and arcanum.png.
# EXCLUDES entries ending in "/" match a path prefix, entries containing
# "*" are bash globs, and every other entry matches one exact path.
# Also embeds a MANIFEST file at the zip root, listing every packaged
# path one per line, so installer.sh/updater.sh can reconcile an
# install without needing git.
# Prints the absolute path of the produced zip as the last line of
# stdout.
#
# With --list (must be the first argument), prints the would-be MANIFEST
# instead (the same filtered paths, same order, one per line, nothing
# else on stdout) and exits 0 without creating the zip, the output
# directory or a MANIFEST file — so it does not need `zip` installed.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

LIST_ONLY=false
if [[ "${1:-}" == "--list" ]]; then
  LIST_ONLY=true
  shift
fi

EXCLUDES=(
  "AGENTS.md"
  "CLAUDE.md"
  ".claude/"
  "docs/"
  ".github/"
  "ISSUE_TEMPLATE.md"
  ".gitignore"
  "scripts/"
  "cli/"
  "core/spec/"
  "shared/spec/"
  ".circleci/"
  ".codacy.yml"
  ".markdownlint.json"
  ".markdownlintignore"
  "Makefile"
  "arcanum.png"
  "core/eslint.config.mjs"
  "core/.jscpd.json"
  "core/docker-compose.yml"
  "shared/eslint.config.mjs"
  "arcanum-next-step/tsconfig.json"
  "arcanum-next-step/hooks/test-support.ts"
  "arcanum-next-step/hooks/*.test.ts"
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
    elif [[ "$exclude" == *"*"* ]]; then
      # Glob entry: the right side is deliberately unquoted so bash
      # pattern-matches it (e.g. "arcanum-next-step/hooks/*.test.ts").
      # shellcheck disable=SC2053
      [[ "$path" == $exclude ]] && return 0
    elif [[ "$exclude" == */ ]]; then
      [[ "$path" == "$exclude"* ]] && return 0
    else
      [[ "$path" == "$exclude" ]] && return 0
    fi
  done
  return 1
}

# Fills FILES with every git-tracked path not matched by is_excluded,
# in `git ls-files` order. Shared by the --list and zip-building paths.
collect_files() {
  FILES=()
  local path
  while IFS= read -r path; do
    is_excluded "$path" || FILES+=("$path")
  done < <(git -C "$REPO_ROOT" ls-files)
}

if [[ "$LIST_ONLY" == true ]]; then
  collect_files
  if (( ${#FILES[@]} > 0 )); then
    printf '%s\n' "${FILES[@]}"
  fi
  exit 0
fi

OUTPUT_DIR="${1:-dist}"
[[ "$OUTPUT_DIR" = /* ]] || OUTPUT_DIR="${REPO_ROOT}/${OUTPUT_DIR}"

VERSION="$(tr -d '[:space:]' < "${REPO_ROOT}/arcanum.version")"

mkdir -p "$OUTPUT_DIR"
ZIP_PATH="${OUTPUT_DIR}/arcanum-${VERSION}.zip"
rm -f "$ZIP_PATH"

cd "$REPO_ROOT"

collect_files

zip -q "$ZIP_PATH" "${FILES[@]}"

MANIFEST_PATH="${OUTPUT_DIR}/MANIFEST"
printf '%s\n' "${FILES[@]}" > "$MANIFEST_PATH"
zip -j -q "$ZIP_PATH" "$MANIFEST_PATH"
rm -f "$MANIFEST_PATH"

echo "$ZIP_PATH"
