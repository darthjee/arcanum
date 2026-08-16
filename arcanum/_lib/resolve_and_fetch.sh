#!/usr/bin/env bash
# Resolve an issue ID and guarantee its content exists locally, fetching
# from GitHub when needed. discuss-issue only operates on real, existing
# GitHub issues, so callers get a single unified contract: after this
# script exits 0, FILE exists on disk — whether it already had content or
# was just fetched is an implementation detail callers don't need to know.
# The only case outside of that is the GitHub issue not existing (or no id
# being given at all), reported as STATUS=error.
#
# Before resolving/fetching anything, also fetches and checks out the
# configured "safe" branch (arcanum/_lib/checkout_safe_branch.sh — see
# arcanum/_lib/safe_branch.sh) so the working tree never sits on whatever
# branch happened to be checked out before this ran. A dirty tracked-file
# working tree makes that call fail hard (nonzero exit, stderr message,
# no STATUS= line at all) — a failure mode outside the STATUS=ok/
# STATUS=error contract below, which is specifically about "does the
# GitHub issue exist."
# Usage: resolve_and_fetch.sh <repo_path> <issues_folder> <arg_string>
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
# arcanum-split-issue's Step 1, all of which call this file (directly or
# through a thin wrapper). A dirty tracked-file working tree makes this
# hard-error (message to stderr, exit 1) before any STATUS= line is ever
# printed — deliberately outside this script's own STATUS=ok/STATUS=error
# contract, which is specifically about "does the GitHub issue exist,"
# not this. See docs/agents/architecture/branch-bootstrap-and-merge-conflicts.md
# for the full writeup.
"${SCRIPT_DIR}/checkout_safe_branch.sh" "$REPO_PATH" >/dev/null

SCENARIO="" ID="" TITLE="" FILE="" STATUS="" NEEDS_FETCH=""
while IFS='=' read -r key value; do
  case "$key" in
    SCENARIO) SCENARIO="$value" ;;
    ID) ID="$value" ;;
    TITLE) TITLE="$value" ;;
    FILE) FILE="$value" ;;
    STATUS) STATUS="$value" ;;
    NEEDS_FETCH) NEEDS_FETCH="$value" ;;
  esac
done < <("$SCRIPT_DIR/resolve_id_and_file.sh" "$ISSUES_FOLDER" "$ARG_STRING")

if [[ "$STATUS" == "missing_id" ]]; then
  printf 'STATUS=error\nERROR=No GitHub issue id was given for discuss-issue (it only handles existing GitHub issues).\n'
  exit 0
fi

if [[ "$STATUS" == "existing" ]]; then
  printf 'STATUS=ok\nID=%s\nTITLE=%s\nFILE=%s\n' "$ID" "$TITLE" "$FILE"
  exit 0
fi

# STATUS=new + NEEDS_FETCH=true (the only remaining case once an id is known)
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
