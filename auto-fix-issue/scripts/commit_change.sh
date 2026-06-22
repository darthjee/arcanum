#!/usr/bin/env bash
# Commit changes already staged by a specialist agent
# Usage: commit_change.sh <type> <scope> <id> <subject> <agent> <model_name> <model_email> [body] [comment_url]
#
# Builds a commit message using the repo's commit message template
# (.github/commit_message_template.md) and commits with `git commit -F -`.
# Unlike commit_plan.sh/commit_issue.sh (which always commit on behalf of
# the architect and stage a fixed path), this script is fully parameterized:
# any specialist agent (backend, frontend, infra, ...) can call it with its
# own type/scope/subject, and it does NOT run `git add` — the caller is
# expected to have already staged the files it wants committed.
#
# [comment_url], when given, is the URL of the PR review/comment this
# commit addresses; it is added as an "Addresses-Comment:" trailer. Omit it
# for commits not tied to a specific comment (e.g. initial commits).

set -euo pipefail

TYPE="${1:-}"
SCOPE="${2:-}"
ID="${3:-}"
SUBJECT="${4:-}"
AGENT="${5:-}"
MODEL_NAME="${6:-}"
MODEL_EMAIL="${7:-}"
BODY="${8:-}"
COMMENT_URL="${9:-}"

[[ -n "$TYPE" && -n "$SCOPE" && -n "$ID" && -n "$SUBJECT" && -n "$AGENT" && -n "$MODEL_NAME" && -n "$MODEL_EMAIL" ]] || {
  echo "Usage: $0 <type> <scope> <id> <subject> <agent> <model_name> <model_email> [body] [comment_url]" >&2
  exit 1
}

{
  echo "${TYPE}(${SCOPE}): ${SUBJECT} (issue #${ID})"
  if [[ -n "$BODY" ]]; then
    echo
    echo "$BODY"
  fi
  if [[ -n "$COMMENT_URL" ]]; then
    echo
    echo "Addresses-Comment: ${COMMENT_URL}"
  fi
  echo
  echo "Co-Authored-By: ${MODEL_NAME} <${MODEL_EMAIL}>"
  echo "Co-Authored-By: ${AGENT} agent <${MODEL_EMAIL}>"
} | git commit -F -
