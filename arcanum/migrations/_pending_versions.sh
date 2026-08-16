# Shared helper: computes which arcanum/migrations/repos/<version>/
# folders are pending, sorted ascending, under the three-pointer scheme
# (committed version + local-only version + global version — see
# docs/guides/arcanum-repo-version.md). Used by run.sh and
# select_version.sh so both agree on the same semver-aware (not
# lexicographic) comparison — e.g. 0.10.0 > 0.9.0 — and the same
# scope-vs-pointer gating.
#
# A version folder is pending if any axis still has unsatisfied work
# in it: it has at least one "repo"-scoped manifest entry and the
# committed version is strictly less than the folder, OR it has at
# least one "local"-scoped manifest entry and the local version is
# strictly less than the folder, OR it has at least one "global"-scoped
# manifest entry and the global version is strictly less than the
# folder. This mirrors the single-loop, tri-gating design: a folder can
# be revisited by one clone for its local- or global-scoped entries
# alone, long after its repo-scoped entries were already satisfied (and
# shipped) via another clone's commit.
#
# This file is meant to be SOURCED, not executed directly. Requires the
# caller to set MIGRATIONS_SCRIPT_DIR to the migrations scripts' own
# directory (arcanum/migrations) before sourcing this file (it sources
# _manifest.sh itself, relative to MIGRATIONS_SCRIPT_DIR).

# shellcheck source=_manifest.sh
source "${MIGRATIONS_SCRIPT_DIR}/_manifest.sh"

# _version_gt <a> <b>
#   Exits 0 if semver <a> (X.Y.Z) is strictly greater than <b>, 1
#   otherwise. Field-by-field numeric comparison, not lexicographic.
_version_gt() {
  local a="$1" b="$2"
  local a1 a2 a3 b1 b2 b3
  IFS='.' read -r a1 a2 a3 <<<"$a"
  IFS='.' read -r b1 b2 b3 <<<"$b"
  (( a1 > b1 )) && return 0
  (( a1 < b1 )) && return 1
  (( a2 > b2 )) && return 0
  (( a2 < b2 )) && return 1
  (( a3 > b3 )) && return 0
  return 1
}

# _pending_versions <committed_version> <local_version> <global_version>
#   Prints, one per line, every version folder name under
#   ${MIGRATIONS_SCRIPT_DIR}/repos/ whose manifest has at least one
#   "repo"-scoped entry beyond <committed_version>, at least one
#   "local"-scoped entry beyond <local_version>, or at least one
#   "global"-scoped entry beyond <global_version>, sorted ascending.
#   Folder names that aren't valid semver (e.g. "next") are always
#   skipped — this is what excludes "next" without needing to name it
#   explicitly, now that it always carries a (possibly empty)
#   migrations.json.
_pending_versions() {
  local committed="$1" local_version="$2" global_version="$3"

  local dir base
  for dir in "${MIGRATIONS_SCRIPT_DIR}"/repos/*/; do
    base="$(basename "$dir")"
    [[ "$base" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || continue

    if _manifest_has_scope "$dir" repo && _version_gt "$base" "$committed"; then
      echo "$base"
    elif _manifest_has_scope "$dir" local && _version_gt "$base" "$local_version"; then
      echo "$base"
    elif _manifest_has_scope "$dir" global && _version_gt "$base" "$global_version"; then
      echo "$base"
    fi
  done | sort -t. -k1,1n -k2,2n -k3,3n
}
