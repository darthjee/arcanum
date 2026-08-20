#!/usr/bin/env bash
# Shell implementation of the "resolve-and-fetch" migrated entrypoint —
# see docs/agents/architecture/script-engine.md and
# docs/agents/plans/193-migrate-resolve-and-fetch-sh-to-a-native--node-js--implementation/plan.md
# for the full design/shared contracts. Invoked either directly (when
# engine.mode=shell) or as the fallback for engine.mode=native without
# a native implementation yet, via arcanum/_lib/resolve_and_fetch.sh's
# engine_dispatch shim — never called directly by skills.
#
# Resolve an issue ID and guarantee its content exists locally, fetching
# from GitHub when needed. discuss-issue only operates on real, existing
# GitHub issues, so callers get a single unified contract: after this
# script exits 0, FILE exists on disk — whether it already had content or
# was just fetched is an implementation detail callers don't need to know.
# The only case outside of that is the GitHub issue not existing (or an
# invalid/missing id being given at all), reported as STATUS=error.
#
# Before resolving/fetching anything, also fetches and checks out the
# configured "safe" branch (arcanum/_lib/checkout_safe_branch.sh — see
# arcanum/_lib/safe_branch.sh) so the working tree never sits on whatever
# branch happened to be checked out before this ran. A dirty tracked-file
# working tree makes that call fail hard (nonzero exit, stderr message,
# no STATUS= line at all) — a failure mode outside the STATUS=ok/
# STATUS=error contract below, which is specifically about "does the
# GitHub issue exist."
# Usage: resolve_and_fetch_shell.sh <repo_path> <issues_folder> <arg_string>
#
# Input grammar: <arg_string> must match '^#[0-9]+$' (surrounding
# whitespace trimmed). Anything else is STATUS=error.
#
# Output (key=value lines):
#   STATUS=ok      ID, TITLE, FILE always set; DOMAIN, REPO set only when
#                  freshly fetched
#   STATUS=error   ERROR set, ID set when a numeric id was given

set -euo pipefail

REPO_PATH="${1:-}"
ISSUES_FOLDER="${2:-}"
ARG_STRING="${3:-}"

[[ -n "$REPO_PATH" ]] || { echo "Usage: $0 <repo_path> <issues_folder> [arg_string]" >&2; exit 1; }
[[ -n "$ISSUES_FOLDER" ]] || { echo "Usage: $0 <repo_path> <issues_folder> [arg_string]" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Park the working tree on the configured safe branch (default
# "origin/main") before resolving/fetching anything below — this is the
# opening checkout shared by enhance-issue, discuss-issue, and
# arcanum-split-issue's Step 1, all of which call this file (through
# arcanum/_lib/resolve_and_fetch.sh's dispatch shim, directly or through
# a thin per-skill wrapper). A dirty tracked-file working tree makes this
# hard-error (message to stderr, exit 1) before any STATUS= line is ever
# printed — deliberately outside this script's own STATUS=ok/STATUS=error
# contract, which is specifically about "does the GitHub issue exist,"
# not this. See docs/agents/architecture/branch-bootstrap-and-merge-conflicts.md
# for the full writeup.
"${SCRIPT_DIR}/checkout_safe_branch.sh" "$REPO_PATH" >/dev/null

title_from_filename() {
  local base
  base=$(basename "$1" .md)
  # Strip leading ID prefix (up to first _ or -)
  local title_part="${base#*_}"
  [[ "$title_part" == "$base" ]] && title_part="${base#*-}"
  echo "$title_part" | tr '_-' ' ' \
    | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2)); print}'
}

# --- Parse the simplified '#<id>' input grammar ---

TRIMMED="$ARG_STRING"
TRIMMED="${TRIMMED#"${TRIMMED%%[![:space:]]*}"}"
TRIMMED="${TRIMMED%"${TRIMMED##*[![:space:]]}"}"

if [[ ! "$TRIMMED" =~ ^#([0-9]+)$ ]]; then
  ERROR_MSG="Error: invalid input '${ARG_STRING}' — expected '#<id>'"
  printf 'STATUS=error\nERROR=%s\n' "$ERROR_MSG"
  exit 0
fi

ID="${BASH_REMATCH[1]}"

# Resolve the search directory against $REPO_PATH — $ISSUES_FOLDER is a
# caller-supplied path relative to the repo (e.g. "docs/agents/issues"),
# never relative to the ambient shell cwd this script happens to be
# invoked from. Trailing slashes on either $REPO_PATH or $ISSUES_FOLDER
# are trimmed before joining so the join never produces a doubled slash.
ISSUES_FOLDER_TRIMMED="${ISSUES_FOLDER%/}"
SEARCH_DIR="${REPO_PATH%/}/${ISSUES_FOLDER_TRIMMED}"

EXISTING=$(find "$SEARCH_DIR" -maxdepth 1 \( -name "${ID}_*" -o -name "${ID}-*" \) 2>/dev/null | head -1)

if [[ -n "$EXISTING" ]]; then
  EXISTING_BASENAME=$(basename "$EXISTING")
  # FILE is printed relative to $REPO_PATH (via $ISSUES_FOLDER), not as
  # the absolute $SEARCH_DIR path used for the filesystem lookup above.
  FILE="${ISSUES_FOLDER_TRIMMED}/${EXISTING_BASENAME}"
  TITLE=$(title_from_filename "$EXISTING_BASENAME")
  printf 'STATUS=ok\nID=%s\nTITLE=%s\nFILE=%s\n' "$ID" "$TITLE" "$FILE"
  exit 0
fi

# No local file yet — fetch the issue from GitHub.
if FETCH_OUTPUT=$("$SCRIPT_DIR/github_issue.sh" fetch "$REPO_PATH" "$ID" 2>/tmp/resolve_and_fetch.err.$$); then
  rm -f /tmp/resolve_and_fetch.err.$$
  echo "STATUS=ok"
  echo "ID=$ID"
  echo "$FETCH_OUTPUT"
else
  FETCH_ERR=$(cat /tmp/resolve_and_fetch.err.$$ 2>/dev/null || true)
  rm -f /tmp/resolve_and_fetch.err.$$
  printf 'STATUS=error\nID=%s\nERROR=%s\n' "$ID" "${FETCH_ERR:-Could not find GitHub issue #$ID}"
fi
