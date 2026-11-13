#!/usr/bin/env bash
# Top-level chain decision for the auto-plan-issue skill — see
# docs/agents/architecture/skill-finish.md#next-step-map for the full
# design/shared contracts. Shell twin of the `auto-plan-issue-auto-next`
# dispatched command: the auto_next.sh shim runs it via engine_dispatch
# (status `host-only`, so under docker the native command runs on the host
# with the host's git credentials). It calls the
# arcanum/_lib/next_step_prompt.sh shim (itself dispatched). Called only by a
# top-level auto-plan-issue run (never with NESTED=true), on both success
# exits ("plan written" and "plan already exists"), before the success
# report.
#
# Usage: auto_next_shell.sh <repo_path> <id>
#
# Flow:
#   1. If <repo_path>'s current branch is not issue-<id>: CHAIN=no,
#      REASON=branch (no config read, no push, no label change, no checkout).
#   2. Runs next_step_prompt.sh --auto-key auto-plan-issue --no-prompt for
#      the command "/loop /auto-resolve-issue <id>". Its stderr (the
#      "auto-continuing: ..." notice) passes through untouched.
#   3. Always runs `git -C <repo_path> push` (output to stderr). On failure:
#      CHAIN=no, REASON=push (stays on issue-<id>, no mark-ready, no checkout).
#   4. Marks the issue Ready (github_issue.sh mark-ready, output to stderr,
#      best-effort): READY=true on exit 0, else READY=false.
#   5. On CHOICE=yes: CHAIN=yes, CLEAR=true when the prompt printed it, then
#      READY=. Stays on issue-<id>.
#   6. On CHOICE=no: releases to the safe branch (checkout_safe_branch.sh,
#      output to stderr, best-effort): CHAIN=no, REASON=config, READY=,
#      RELEASED=true|false.
#
# Output (stdout, key=value lines only) and exit code:
#   CHAIN=yes [CLEAR=true] READY=<b>                 exit 0
#   CHAIN=no REASON=config READY=<b> RELEASED=<b>    exit 0
#   CHAIN=no REASON=push|branch                      exit 0
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
GITHUB_ISSUE="${SCRIPT_DIR}/../../arcanum/_lib/github_issue.sh"
CHECKOUT_SAFE_BRANCH="${SCRIPT_DIR}/../../arcanum/_lib/checkout_safe_branch.sh"
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

clear=false
printf '%s\n' "$prompt_output" | grep -qx 'CLEAR=true' && clear=true

git -C "$REPO_PATH" push >&2 || chain_no push

ready=false
if "$GITHUB_ISSUE" mark-ready "$REPO_PATH" "$ID" >&2; then ready=true; fi

if [[ "$choice" == "yes" ]]; then
  echo "CHAIN=yes"
  [[ "$clear" != "true" ]] || echo "CLEAR=true"
  echo "READY=${ready}"
  exit 0
fi

released=true
"$CHECKOUT_SAFE_BRANCH" "$REPO_PATH" >&2 || released=false

echo "CHAIN=no"
echo "REASON=config"
echo "READY=${ready}"
echo "RELEASED=${released}"
