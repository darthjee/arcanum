#!/usr/bin/env bash
# Create ONE sub-issue on GitHub from a local sub-issue draft file, link it
# to the parent as a native GitHub sub-issue, and track it in
# .claude/state/issue-<issue_id>.json.
# Usage: create_sub_issue.sh <repo_path> <issue_id> <sub_issue_file>
#
# On success prints:
#   STATUS=ok
#   ID=<new_id>
# and exits 0. On failure (gh issue create exhausts its retry budget)
# prints:
#   STATUS=failed
# and exits 1.

set -euo pipefail

REPO_PATH="${1:-}"
ISSUE_ID="${2:-}"
SUB_ISSUE_FILE="${3:-}"

[[ -n "$REPO_PATH" && -n "$ISSUE_ID" && -n "$SUB_ISSUE_FILE" ]] || {
  echo "Usage: $0 <repo_path> <issue_id> <sub_issue_file>" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="${SCRIPT_DIR}/../../arcanum/_lib"

# shellcheck source=../../arcanum/_lib/repo_path.sh
# shellcheck disable=SC1091
source "${LIB_DIR}/repo_path.sh"
# shellcheck source=../../arcanum/_lib/origin.sh
# shellcheck disable=SC1091
source "${LIB_DIR}/origin.sh"
# shellcheck source=../../arcanum/_lib/repo_config.sh
# shellcheck disable=SC1091
source "${LIB_DIR}/repo_config.sh"

repo_path_enter "$REPO_PATH"

[[ -f "$SUB_ISSUE_FILE" ]] || { echo "Error: file not found: $SUB_ISSUE_FILE" >&2; exit 1; }

# --- Parse title/body from the sub-issue file: first line is the title
# (a leading "# " is stripped, if present), and the body is everything
# after the first blank line (mirrors how create_sub_issue_file.sh writes
# it: title line, blank line, body).

TITLE_LINE=$(sed -n '1p' "$SUB_ISSUE_FILE")
TITLE="${TITLE_LINE#\# }"
BODY=$(awk 'NR==1{next} !found && /^$/{found=1; next} found{print}' "$SUB_ISSUE_FILE")

# --- Best-effort count segment for logging only ---

BASE="$(basename "$SUB_ISSUE_FILE")"
REST="${BASE#${ISSUE_ID}_}"
COUNT_SEGMENT="${REST%%_*}"
if [[ ! "$COUNT_SEGMENT" =~ ^[0-9]+$ ]]; then
  COUNT_SEGMENT=""
fi

_load_origin "$REPO_PATH"
repo_ref="$_ORIGIN_REPO_PATH"

# --- Build the label list: parent's labels with Planning swapped for Writting ---

LABELS=()
HAS_WRITTING=0
while IFS= read -r label; do
  [[ -n "$label" ]] || continue
  if [[ "$label" == "Planning" ]]; then
    LABELS+=("Writting")
    HAS_WRITTING=1
  else
    LABELS+=("$label")
    [[ "$label" == "Writting" ]] && HAS_WRITTING=1
  fi
done < <(gh issue view "$ISSUE_ID" -R "$repo_ref" --json labels -q '.labels[].name')

if [[ "$HAS_WRITTING" -eq 0 ]]; then
  LABELS+=("Writting")
fi

LABEL_ARGS=()
for label in "${LABELS[@]+"${LABELS[@]}"}"; do
  LABEL_ARGS+=(--label "$label")
done

# --- Retry config ---

max_retry=$(repo_config_read ".claude/state/arcanum-config.json" "" "plan-issues" "max-retry-count")
max_retry="${max_retry//\"/}"
[[ -n "$max_retry" ]] || max_retry=5

error_sleep=$(repo_config_read ".claude/state/arcanum-config.json" "" "plan-issues" "error-sleep-time")
error_sleep="${error_sleep//\"/}"
[[ -n "$error_sleep" ]] || error_sleep=5

# --- Retry loop around gh issue create ---

new_id=""
attempt=0
success=0
count_label="${COUNT_SEGMENT:-?}"
while (( attempt < max_retry )); do
  attempt=$((attempt + 1))
  echo "Creating sub-issue ${count_label} for issue #${ISSUE_ID}: ${TITLE} (attempt ${attempt}/${max_retry})"

  err_output=""
  if url=$(gh issue create -R "$repo_ref" --title "$TITLE" --body "$BODY" "${LABEL_ARGS[@]}" 2>/tmp/create_sub_issue.err.$$); then
    rm -f /tmp/create_sub_issue.err.$$
    new_id="${url##*/}"
    success=1
    break
  else
    err_output=$(cat /tmp/create_sub_issue.err.$$ 2>/dev/null || true)
    rm -f /tmp/create_sub_issue.err.$$
    echo "Warning: gh issue create failed (attempt ${attempt}/${max_retry}): ${err_output}" >&2
    if (( attempt < max_retry )); then
      sleep "$error_sleep"
    fi
  fi
done

if [[ "$success" -ne 1 ]]; then
  echo "STATUS=failed"
  exit 1
fi

# --- Link as a native GitHub sub-issue (best-effort) ---

parent_node_id=$(gh issue view "$ISSUE_ID" -R "$repo_ref" --json id -q .id)
sub_node_id=$(gh issue view "$new_id" -R "$repo_ref" --json id -q .id)

gh api graphql -f query='mutation($issueId:ID!,$subIssueId:ID!){addSubIssue(input:{issueId:$issueId,subIssueId:$subIssueId}){subIssue{id}}}' -F issueId="$parent_node_id" -F subIssueId="$sub_node_id" >/dev/null 2>&1 \
  || echo "Warning: could not link issue #$new_id as a native sub-issue of #$ISSUE_ID — created but not linked; link it manually on GitHub" >&2

# --- Track the new id in state (regardless of linking outcome) ---

"${LIB_DIR}/issue_state.sh" append-json "$ISSUE_ID" sub-issues "\"$new_id\""

echo "STATUS=ok"
echo "ID=$new_id"
