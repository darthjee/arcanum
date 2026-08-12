#!/usr/bin/env bash
# Post an attributed reply comment on the current branch's PR
# Usage: reply_comment.sh <repo_path> <id> <agent> <model_name> <model_email> <reply_body>
#
# <repo_path>: local checkout path of the target repo, used to resolve
# origin explicitly rather than trusting ambient shell cwd.
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

source "${SCRIPT_DIR}/../../arcanum/_lib/origin.sh"
source "${SCRIPT_DIR}/../../arcanum/_lib/push.sh"
source "${SCRIPT_DIR}/../../arcanum/_lib/repo_path.sh"

REPO_PATH="${1:-}"
ID="${2:-}"
AGENT="${3:-}"
MODEL_NAME="${4:-}"
MODEL_EMAIL="${5:-}"
REPLY_BODY="${6:-}"
ID="${ID#\#}"

usage() {
  echo "Usage: $0 <repo_path> <id> <agent> <model_name> <model_email> <reply_body>" >&2
  exit 1
}

[[ -n "$REPO_PATH" ]] || usage
[[ "$ID" =~ ^[0-9]+$ ]] || usage
[[ -n "$AGENT" && -n "$MODEL_NAME" && -n "$MODEL_EMAIL" && -n "$REPLY_BODY" ]] || usage

repo_path_enter "$REPO_PATH"

PR_NUMBER=$("$RESOLVE_PR_NUMBER" "$REPO_PATH" "$ID")

_ensure_gh_user
REPO_REF=$(get_repo_ref "$REPO_PATH")

content=$(cat "$TEMPLATE")
content="${content/\%\%BODY\%\%/$REPLY_BODY}"
content="${content/\%\%AGENT\%\%/$AGENT}"
content="${content/\%\%MODEL_NAME\%\%/$MODEL_NAME}"
content="${content/\%\%MODEL_EMAIL\%\%/$MODEL_EMAIL}"

printf '%s\n' "$content" | gh pr comment "$PR_NUMBER" -R "$REPO_REF" --body-file -

push_current_branch
