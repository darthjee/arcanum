#!/usr/bin/env bash
# CI backstop (non-blocking) for the .github/ and init-claude/templates/
# copies of the commit-message templates silently drifting apart. Dev
# tooling, run from the `checks` CircleCI job (every push) — NOT a skill
# script under <skill>/scripts/.
#
# .github/commit_message_template.md and
# init-claude/templates/commit_message_template.md are meant to stay
# byte-identical (same for the "-2.0" pair) — see issue #507. This script
# diffs each pair and, on a mismatch, prints the diff to stderr with a
# one-line instruction. It always exits 0 — this must never block a build.
#
# Usage: scripts/check_commit_template_sync.sh   (no arguments)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

STATUS=0

check_pair() {
  local left="$1" right="$2"

  if [[ ! -f "$left" || ! -f "$right" ]]; then
    echo "Warning: '${left}' or '${right}' is missing — cannot verify they are in sync. Not blocking the build." >&2
    return
  fi

  if ! diff -u "$left" "$right" >/dev/null 2>&1; then
    echo "############################################################" >&2
    echo "# WARNING: '${left}' and '${right}' have drifted apart." >&2
    echo "# Keep both copies identical." >&2
    echo "############################################################" >&2
    diff -u "$left" "$right" >&2 || true
    STATUS=1
  fi
}

check_pair "${REPO_ROOT}/.github/commit_message_template.md" "${REPO_ROOT}/init-claude/templates/commit_message_template.md"
check_pair "${REPO_ROOT}/.github/commit_message_template-2.0.md" "${REPO_ROOT}/init-claude/templates/commit_message_template-2.0.md"

if [[ "$STATUS" -ne 0 ]]; then
  echo "Commit-message templates are out of sync (see warnings above). Not blocking the build." >&2
fi

exit 0
