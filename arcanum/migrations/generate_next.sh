#!/usr/bin/env bash
# Compute the next pending-migration filename under
# arcanum/migrations/repos/next/.
# Usage: generate_next.sh
#
# Looks at existing NNN.sh files (3-digit zero-padded) under repos/next/
# and prints the next number, zero-padded to 3 digits, to stdout: "001"
# if none exist yet, otherwise (highest existing number) + 1. Never
# fills a gap left by a deleted/skipped file. Exits 0.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NEXT_DIR="${SCRIPT_DIR}/repos/next"

HIGHEST=0
shopt -s nullglob
for f in "${NEXT_DIR}"/[0-9][0-9][0-9].sh; do
  base="$(basename "$f" .sh)"
  num=$((10#$base))
  if (( num > HIGHEST )); then
    HIGHEST=$num
  fi
done
shopt -u nullglob

printf '%03d\n' "$((HIGHEST + 1))"
