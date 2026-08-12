# Shared helper: computes which arcanum/migrations/repos/<version>/
# folders are pending (strictly greater than a given current version),
# sorted ascending. Used by run.sh and select_version.sh so both agree
# on the same semver-aware (not lexicographic) comparison — e.g.
# 0.10.0 > 0.9.0.
#
# This file is meant to be SOURCED, not executed directly. Requires the
# caller to set MIGRATIONS_SCRIPT_DIR to the migrations scripts' own
# directory (arcanum/migrations) before calling _pending_versions.

# _pending_versions <current_version>
#   Prints, one per line, every version folder name under
#   ${MIGRATIONS_SCRIPT_DIR}/repos/ (excluding "next") strictly greater
#   than <current_version>, sorted ascending.
_pending_versions() {
  local current="$1"
  local c1 c2 c3
  IFS='.' read -r c1 c2 c3 <<<"$current"

  local dir base b1 b2 b3
  for dir in "${MIGRATIONS_SCRIPT_DIR}"/repos/*/; do
    base="$(basename "$dir")"
    [[ "$base" == "next" ]] && continue
    [[ "$base" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || continue
    IFS='.' read -r b1 b2 b3 <<<"$base"
    if (( b1 > c1 )) || { (( b1 == c1 )) && (( b2 > c2 )); } || { (( b1 == c1 )) && (( b2 == c2 )) && (( b3 > c3 )); }; then
      echo "$base"
    fi
  done | sort -t. -k1,1n -k2,2n -k3,3n
}
