#!/usr/bin/env bash
# Top-level chain decision for the auto-plan-issue skill — see
# docs/agents/architecture/skill-finish.md#next-step-map for the full
# design/shared contracts. Plain bash, NOT engine-dispatched (like
# arcanum/_lib/next_step_prompt.sh, which it calls). Called only by a
# top-level auto-plan-issue run (never with NESTED=true), on both success
# exits ("plan written" and "plan already exists"), before the success
# report.
#
# Usage: auto_next.sh <repo_path> <id>
#
# Flow:
#   1. If <repo_path>'s current branch is not issue-<id>: CHAIN=no,
#      REASON=branch (no config read).
#   2. Runs next_step_prompt.sh --auto-key auto-plan-issue --no-prompt for
#      the command "/loop /auto-resolve-issue <id>". Its stderr (the
#      "auto-continuing: ..." notice) passes through untouched. On
#      CHOICE=no: CHAIN=no, REASON=config.
#   3. On CHOICE=yes: runs `git -C <repo_path> push` (git's output goes to
#      stderr). On failure: CHAIN=no, REASON=push. On success: CHAIN=yes.
#
# Output (stdout, key=value lines only) and exit code:
#   CHAIN=yes                                   exit 0
#   CHAIN=no + REASON=branch|config|push        exit 0
#   usage error (missing args, <repo_path> not a directory), or
#   next_step_prompt.sh failed -> nothing on stdout, error on stderr, exit 1

set -euo pipefail

REPO_PATH="${1:-}"
ID="${2:-}"

[[ -n "$REPO_PATH" && -n "$ID" ]] || {
  echo "Usage: $0 <repo_path> <id>" >&2
  exit 1
}

[[ -d "$REPO_PATH" ]] || {
  echo "Error: repo path '$REPO_PATH' is not a directory" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NEXT_STEP_PROMPT="${SCRIPT_DIR}/../../arcanum/_lib/next_step_prompt.sh"
AUTO_KEY="auto-plan-issue"
NEXT_COMMAND="/loop /auto-resolve-issue ${ID}"

chain_no() {
  echo "CHAIN=no"
  echo "REASON=$1"
  exit 0
}

branch=$(git -C "$REPO_PATH" rev-parse --abbrev-ref HEAD 2>/dev/null) || branch=""
[[ "$branch" == "issue-${ID}" ]] || chain_no branch

prompt_output=$("$NEXT_STEP_PROMPT" --repo "$REPO_PATH" --command "$NEXT_COMMAND" \
  --auto-key "$AUTO_KEY" --no-prompt) || {
  echo "Error: next_step_prompt.sh failed for auto key '$AUTO_KEY'" >&2
  exit 1
}

choice=$(printf '%s\n' "$prompt_output" | sed -n 's/^CHOICE=//p' | head -n 1)
[[ "$choice" == "yes" ]] || chain_no config

git -C "$REPO_PATH" push >&2 || chain_no push

echo "CHAIN=yes"
