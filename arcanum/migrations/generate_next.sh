#!/usr/bin/env bash
# Compute the next pending-migration id under
# arcanum/migrations/repos/next/.
# Usage: generate_next.sh
#
# Reads repos/next/migrations.json (always present — an empty array
# when nothing is pending yet) and prints the next id, zero-padded to
# 3 digits, to stdout: "001" if the array is empty, otherwise (highest
# existing "id" across all entries) + 1. Never fills a gap left by a
# deleted/skipped entry. Exits 0.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NEXT_MANIFEST="${SCRIPT_DIR}/repos/next/migrations.json"

HIGHEST=0
if [[ -f "$NEXT_MANIFEST" ]]; then
  while IFS= read -r id; do
    [[ -n "$id" ]] || continue
    num=$((10#$id))
    if (( num > HIGHEST )); then
      HIGHEST=$num
    fi
  done < <(jq -r '.[].id' "$NEXT_MANIFEST")
fi

printf '%03d\n' "$((HIGHEST + 1))"
