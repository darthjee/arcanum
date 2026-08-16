#!/usr/bin/env bash
# Wait for CI, then merge the PR internally — the `shipit`-preapproved
# merge path only (see issue #170).
# Usage: wait_ci_and_merge.sh <repo_path> [model_email]
#
# Thin orchestrator over the two existing, unmodified scripts
# `wait_ci.sh` and `github.sh pr-merge` — no duplicated CI-polling or
# merge logic. The point of this separate script is presentational to
# Claude Code's own permission classifier: it exposes a single,
# distinctly-named Bash invocation that can be allowlisted narrowly
# (see the local/repo/global migrations in
# arcanum/migrations/repos/next/ and init-claude/setup_permissions.md)
# without loosening confirmation for the normal, human-review-approved
# merge path, which still calls `wait_ci.sh` then a separate
# `github.sh pr-merge` Bash invocation, unmodified and still classifier-
# confirmed (see auto-fix-all/steps/process_one_issue.md).
#
# Output contract, same first-line shape as wait_ci.sh's own: first
# line "passed" means CI passed AND the merge already happened
# internally (nothing left for the caller to do) — the second line is
# the merged PR's URL, exactly what `github.sh pr-merge` itself prints
# on success. First line "failed" (with subsequent lines listing the
# failed check-run names) means CI failed and the merge was never
# attempted — identical to wait_ci.sh's own "failed" output.
#
# A hard failure of the merge call itself (e.g. a `gh`/API error after
# CI already passed) is not folded into this "passed"/"failed"
# contract — it propagates as a non-zero exit from this script
# (`set -euo pipefail`), same as any other unexpected script failure.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_PATH="${1:?Usage: $0 <repo_path> [model_email]}"
MODEL_EMAIL="${2:-}"

output="$("${SCRIPT_DIR}/wait_ci.sh" "$REPO_PATH")"
status="$(head -1 <<<"$output")"

if [[ "$status" != "passed" ]]; then
  echo "$output"
  exit 0
fi

echo "passed"
"${SCRIPT_DIR}/github.sh" pr-merge "$REPO_PATH" "$MODEL_EMAIL"
