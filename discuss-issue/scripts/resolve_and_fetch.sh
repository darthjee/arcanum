#!/usr/bin/env bash
# Resolve an issue ID and ensure its content is available locally, fetching
# from GitHub when needed. discuss-issue only operates on real, existing
# GitHub issues, so this collapses resolve_id_and_file.sh's general
# scenarios (existing/new+fetch/missing_id) into the three outcomes that
# matter here.
# Usage: resolve_and_fetch.sh <issues_folder> <arg_string>
#
# Output (key=value lines):
#   STATUS=existing       ID, TITLE, FILE set — local file already has content
#   STATUS=fetched        ID, TITLE, FILE, DOMAIN, REPO set — just fetched from GitHub
#                         (TAGS_BEGIN/TAGS_END block follows when the body had one)
#   STATUS=fetch_failed   ID set, ERROR set — id was numeric but GitHub fetch failed
#   STATUS=missing_id     ERROR set — no numeric GitHub issue id was given

set -euo pipefail

ISSUES_FOLDER="${1:-}"
ARG_STRING="${2:-}"

[[ -n "$ISSUES_FOLDER" ]] || { echo "Usage: $0 <issues_folder> [arg_string]" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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
  printf 'STATUS=missing_id\nERROR=No GitHub issue id was given for discuss-issue (it only handles existing GitHub issues).\n'
  exit 0
fi

if [[ "$STATUS" == "existing" ]]; then
  printf 'STATUS=existing\nID=%s\nTITLE=%s\nFILE=%s\n' "$ID" "$TITLE" "$FILE"
  exit 0
fi

# STATUS=new + NEEDS_FETCH=true (the only remaining case once an id is known)
if FETCH_OUTPUT=$("$SCRIPT_DIR/github.sh" fetch "$ID" 2>/tmp/resolve_and_fetch.err.$$); then
  rm -f /tmp/resolve_and_fetch.err.$$
  echo "STATUS=fetched"
  echo "ID=$ID"
  echo "$FETCH_OUTPUT"
else
  FETCH_ERR=$(cat /tmp/resolve_and_fetch.err.$$ 2>/dev/null || true)
  rm -f /tmp/resolve_and_fetch.err.$$
  printf 'STATUS=fetch_failed\nID=%s\nERROR=%s\n' "$ID" "${FETCH_ERR:-Could not find GitHub issue #$ID}"
fi
