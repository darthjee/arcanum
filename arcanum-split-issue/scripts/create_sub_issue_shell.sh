#!/usr/bin/env bash
# Shell implementation of the "arcanum-split-issue-create-sub-issue"
# migrated entrypoint, invoked by the create_sub_issue.sh engine_dispatch
# shim (either directly in shell mode, or as the fallback/parity reference
# for the native implementation in core/bin/arcanum — see
# docs/agents/architecture/script-engine.md). Creates ONE sub-issue on
# GitHub from a local sub-issue draft file, links it to the parent as a
# native GitHub sub-issue, and tracks it in .claude/state/issue-<issue_id>.json.
# Usage: create_sub_issue.sh <repo_path> <issue_id> <sub_issue_file>
#
# Delegates the actual create + label + link work to the shared
# arcanum/_lib/spawn_issue.sh --as-subissue (parent's labels with every
# pipeline tag stripped, plus the permanent Spawned label — see
# spawn_issue.sh for the full label allow-list policy and retry/
# linking/cleanup behavior), keeping only this script's own
# count-segment logging and .claude/state/issue-<issue_id>.json
# "sub-issues" tracking on top of the returned ID.
#
# On success prints:
#   STATUS=ok
#   ID=<new_id>
# and exits 0. On failure (spawn_issue.sh exhausts its retry budget)
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
REST="${BASE#"${ISSUE_ID}"_}"
COUNT_SEGMENT="${REST%%_*}"
if [[ ! "$COUNT_SEGMENT" =~ ^[0-9]+$ ]]; then
  COUNT_SEGMENT=""
fi
count_label="${COUNT_SEGMENT:-?}"

# --- Write the parsed body to a temp scratch file, spawn_issue.sh's own
# create-call input (spawn_issue.sh deletes ITS OWN scratch copy under
# docs/agents/issues/ once done; this temp file is ours to clean up) ---

TMP_BODY_FILE="$(mktemp)"
trap 'rm -f "$TMP_BODY_FILE"' EXIT

printf '%s\n' "$BODY" > "$TMP_BODY_FILE"

echo "Creating sub-issue ${count_label} for issue #${ISSUE_ID}: ${TITLE}"

SPAWN_OUTPUT=""
if ! SPAWN_OUTPUT=$("${LIB_DIR}/spawn_issue.sh" "$REPO_PATH" "$ISSUE_ID" "$TITLE" "$TMP_BODY_FILE" --as-subissue); then
  echo "$SPAWN_OUTPUT"
  echo "STATUS=failed"
  exit 1
fi

# Surface spawn_issue.sh's own progress lines, but not its STATUS/ID/URL
# summary — this script keeps its own historical two-line output
# contract (STATUS=ok / ID=<new_id>) below instead.
grep -v -E '^(STATUS=|ID=|URL=)' <<< "$SPAWN_OUTPUT" || true

new_id=$(grep '^ID=' <<< "$SPAWN_OUTPUT" | head -1 | cut -d= -f2-)

# --- Track the new id in state (regardless of linking outcome) ---

"${LIB_DIR}/issue_state.sh" "$REPO_PATH" append-json "$ISSUE_ID" sub-issues "\"$new_id\""

echo "STATUS=ok"
echo "ID=$new_id"
