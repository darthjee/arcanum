#!/usr/bin/env bash
# Post an attributed reply comment on the current branch's PR
# Usage: reply_comment.sh <id> <agent> <model_name> <model_email> <reply_body>
#
# <id>: numeric GitHub issue id of the currently checked-out "issue-<id>"
# branch; used only to resolve the PR via resolve_pr_number.sh, which reads
# the current branch itself.
# <agent> / <model_name> / <model_email>: attribution fields, same shape
# already passed to auto-fix-issue/scripts/commit_change.sh.
# <reply_body>: full reply text.
#
# Renders ../templates/reply.tmpl.md substituting the reply body and an
# attribution line, then posts it via `gh pr comment`. Exit 0 on success;
# non-zero with a usage/error message on stderr otherwise.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$SCRIPT_DIR/../templates/reply.tmpl.md"
RESOLVE_PR_NUMBER="$SCRIPT_DIR/../../auto-monitor-issue-pr/scripts/resolve_pr_number.sh"

source "${SCRIPT_DIR}/_lib_origin.sh"

ID="${1:-}"
AGENT="${2:-}"
MODEL_NAME="${3:-}"
MODEL_EMAIL="${4:-}"
REPLY_BODY="${5:-}"
ID="${ID#\#}"

usage() {
  echo "Usage: $0 <id> <agent> <model_name> <model_email> <reply_body>" >&2
  exit 1
}

[[ "$ID" =~ ^[0-9]+$ ]] || usage
[[ -n "$AGENT" && -n "$MODEL_NAME" && -n "$MODEL_EMAIL" && -n "$REPLY_BODY" ]] || usage

PR_NUMBER=$("$RESOLVE_PR_NUMBER" "$ID")

_ensure_gh_user
REPO_REF=$(get_repo_ref)

content=$(cat "$TEMPLATE")
content="${content/\%\%BODY\%\%/$REPLY_BODY}"
content="${content/\%\%AGENT\%\%/$AGENT}"
content="${content/\%\%MODEL_NAME\%\%/$MODEL_NAME}"
content="${content/\%\%MODEL_EMAIL\%\%/$MODEL_EMAIL}"

printf '%s\n' "$content" | gh pr comment "$PR_NUMBER" -R "$REPO_REF" --body-file -
