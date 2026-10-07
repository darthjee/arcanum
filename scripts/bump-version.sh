#!/usr/bin/env bash
# Bump arcanum's version.
# Usage: bump-version.sh [new-version]
#
# Updates arcanum.version at the repo root, the baked-in default version
# constant inside arcanum/install/bootstrap.sh (DEFAULT_VERSION), and the
# "Current Version" / "Next Release" lines in README.md. Also rolls
# arcanum/migrations/repos/next/ (pending, unreleased per-repo migrations)
# into arcanum/migrations/repos/<new-version>/, and recreates an empty
# next/ (with a migrations.json containing []) in its place, so a
# migration always ships in the same release as the change it belongs
# to. Also regenerates
# docs/agents/tag-mutations.md (scripts/generate_tags_table.sh, default
# non-interactive mode) and
# docs/agents/architecture/entrypoint-migration-status.md
# (scripts/generate_entrypoint_migration_status.sh), so both self-heal at
# every release even if nobody ran them manually mid-cycle.
# Does NOT commit or tag anything — that remains a separate, manual (or
# future) step.
#
# Migration references: a "migration reference" is the literal text
# repos/next/NNN, where NNN is exactly three digits followed by a non-digit
# or end of line (ERE: repos/next/[0-9]{3}([^0-9]|$)). References are
# scanned in core/spec/**, docs/** and README.md, excluding
# docs/agents/issues/**, docs/agents/plans/** and any node_modules/
# (scripts/ and arcanum/ are never scanned).
#   - Guard: before anything is written, every in-scope reference must
#     point at a file that exists in arcanum/migrations/repos/next/
#     (NNN.*). Any stale reference is printed as "<path>:<line>: <match>"
#     on stderr and the script exits 1, leaving the tree untouched.
#   - Rewrite: when next/ is actually moved into <new-version>/, every
#     in-scope reference to a moved NNN is rewritten from repos/next/NNN to
#     repos/<new-version>/NNN. Only moved ids are rewritten.
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

NEXT_MIGRATIONS_DIR="${MIGRATIONS_REPOS_DIR}/next"
VERSION_MIGRATIONS_DIR="${MIGRATIONS_REPOS_DIR}/${NEW_VERSION}"
MIGRATION_REF_REGEX='repos/next/[0-9]{3}([^0-9]|$)'

if [[ -d "$VERSION_MIGRATIONS_DIR" ]]; then
  echo "Error: ${VERSION_MIGRATIONS_DIR} already exists — refusing to overwrite." >&2
  exit 1
fi
if [[ ! -d "$NEXT_MIGRATIONS_DIR" ]]; then
  echo "Error: ${NEXT_MIGRATIONS_DIR} is missing — expected it to always exist." >&2
  exit 1
fi

# Prints, NUL-separated, every in-scope file that may hold migration
# references: core/spec/**, docs/**, README.md, minus docs/agents/issues/**,
# docs/agents/plans/** and any node_modules/. Missing roots are skipped.
list_reference_scope_files() {
  local roots=()
  local root
  for root in "${REPO_ROOT}/core/spec" "${REPO_ROOT}/docs" "$README_FILE"; do
    [[ -e "$root" ]] && roots+=("$root")
  done
  [[ ${#roots[@]} -gt 0 ]] || return 0
  find "${roots[@]}" \
    \( -path "${REPO_ROOT}/docs/agents/issues" \
       -o -path "${REPO_ROOT}/docs/agents/plans" \
       -o -name node_modules \) -prune \
    -o -type f -print0
}

# Aborts (exit 1) when any in-scope reference names an NNN with no NNN.*
# file in next/. Runs before anything is written.
check_stale_migration_references() {
  local stale=()
  local file hit line match id
  while IFS= read -r -d '' file; do
    while IFS= read -r hit; do
      [[ -n "$hit" ]] || continue
      line="${hit%%:*}"
      match="${hit#*:}"
      match="${match:0:14}"
      id="${match:11:3}"
      if ! compgen -G "${NEXT_MIGRATIONS_DIR}/${id}.*" >/dev/null; then
        stale+=("${file#"${REPO_ROOT}/"}:${line}: ${match}")
      fi
    done < <(grep -noE "$MIGRATION_REF_REGEX" "$file" || true)
  done < <(list_reference_scope_files)

  if [[ ${#stale[@]} -gt 0 ]]; then
    echo "Error: stale arcanum/migrations/repos/next/NNN references — fix them before bumping:" >&2
    printf '%s\n' "${stale[@]}" >&2
    exit 1
  fi
}

# Rewrites repos/next/NNN -> repos/<new-version>/NNN in every in-scope file,
# only for the NNN ids that were moved into VERSION_MIGRATIONS_DIR.
rewrite_moved_migration_references() {
  local ids=()
  local id file count=0
  while IFS= read -r id; do
    ids+=("$id")
  done < <(find "$VERSION_MIGRATIONS_DIR" -maxdepth 1 -type f ! -name migrations.json -exec basename {} \; \
    | grep -oE '^[0-9]{3}\.' | cut -c1-3 | sort -u)
  [[ ${#ids[@]} -gt 0 ]] || return 0

  local files=()
  while IFS= read -r -d '' file; do
    grep -qE "$MIGRATION_REF_REGEX" "$file" && files+=("$file")
  done < <(list_reference_scope_files)

  for file in ${files[@]+"${files[@]}"}; do
    for id in "${ids[@]}"; do
      sed -i.bak -E "s#repos/next/${id}([^0-9]|\$)#repos/${NEW_VERSION}/${id}\1#g" "$file"
      rm -f "${file}.bak"
    done
    count=$((count + 1))
  done
  echo "Rewrote repos/next/NNN references in ${count} file(s)."
}

check_stale_migration_references

echo "$NEW_VERSION" > "$VERSION_FILE"

sed -i.bak -E "s/^DEFAULT_VERSION=\"[^\"]*\"/DEFAULT_VERSION=\"${NEW_VERSION}\"/" "$BOOTSTRAP_FILE"
rm -f "${BOOTSTRAP_FILE}.bak"

"${SCRIPT_DIR}/generate_tags_table.sh"
"${SCRIPT_DIR}/generate_entrypoint_migration_status.sh"

sed -i.bak -E \
  "s#\*\*Current Version:\*\* \[[0-9]+\.[0-9]+\.[0-9]+\]\(https://github.com/${REPO_SLUG}/releases/tag/[0-9]+\.[0-9]+\.[0-9]+\)#**Current Version:** [${NEW_VERSION}](https://github.com/${REPO_SLUG}/releases/tag/${NEW_VERSION})#" \
  "$README_FILE"
sed -i.bak -E \
  "s#\*\*Next Release:\*\* \[[0-9]+\.[0-9]+\.[0-9]+\]\(https://github.com/${REPO_SLUG}/compare/[0-9]+\.[0-9]+\.[0-9]+\.\.\.main\)#**Next Release:** [${NEXT_RELEASE}](https://github.com/${REPO_SLUG}/compare/${NEW_VERSION}...main)#" \
  "$README_FILE"
rm -f "${README_FILE}.bak"

is_migrations_dir_empty() {
  local dir="$1"
  local manifest="${dir}/migrations.json"
  [[ ! -f "$manifest" ]] || [[ "$(jq -c '.' "$manifest" 2>/dev/null)" == "[]" ]]
}

echo "New version:  ${NEW_VERSION}"
echo "Next release: ${NEXT_RELEASE}"
echo "Updated ${VERSION_FILE}, ${BOOTSTRAP_FILE}, ${README_FILE}, docs/agents/tag-mutations.md, and docs/agents/architecture/entrypoint-migration-status.md."

if is_migrations_dir_empty "$NEXT_MIGRATIONS_DIR"; then
  # defensive: keep migrations.json present even if it was missing
  [[ -f "${NEXT_MIGRATIONS_DIR}/migrations.json" ]] || echo "[]" > "${NEXT_MIGRATIONS_DIR}/migrations.json"
  echo "No pending migrations in ${NEXT_MIGRATIONS_DIR} — skipping rename."
else
  mv "$NEXT_MIGRATIONS_DIR" "$VERSION_MIGRATIONS_DIR"
  mkdir -p "$NEXT_MIGRATIONS_DIR"
  echo "[]" > "${NEXT_MIGRATIONS_DIR}/migrations.json"
  echo "Moved ${NEXT_MIGRATIONS_DIR} -> ${VERSION_MIGRATIONS_DIR} and recreated an empty ${NEXT_MIGRATIONS_DIR}."
  rewrite_moved_migration_references
fi
