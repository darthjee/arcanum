#!/usr/bin/env bash
# Deterministically resolve a free-form yes/no-ish reply to a boolean.
# Usage: confirm.sh "<free-form reply>"
#
# Trims surrounding whitespace and trailing punctuation (. ! ?), lowercases
# the reply, then matches it against a fixed affirmative word/phrase list
# (case handled via the lowercasing above): yes, y, sim, correct,
# "looks good", sure, ok, okay.
#
# Exit 0 when the (normalized) reply matches one of those affirmatives.
# Exit 1 for everything else — including explicit negatives (no, n, não,
# nao, nope), anything unrecognized, and a missing/empty argument — since
# "not recognized as affirmative" already means "no" for this contract.

set -euo pipefail

REPLY="${1:-}"

NORMALIZED=$(printf '%s' "$REPLY" | tr '[:upper:]' '[:lower:]' | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//; s/[.!?]+$//')

case "$NORMALIZED" in
  yes|y|sim|correct|"looks good"|sure|ok|okay)
    exit 0
    ;;
  *)
    exit 1
    ;;
esac
