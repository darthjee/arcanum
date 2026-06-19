#!/usr/bin/env bash
# Resolve issue ID, title, and filename from skill arguments and issues folder
# Usage: resolve_id_and_file.sh <issues_folder> [arg_string]
#
# Output (key=value lines):
#   SCENARIO=A|B|C
#   ID=<id>
#   TITLE=<title>          (empty when STATUS=needs_title)
#   FILE=<filepath>        (empty when STATUS=needs_title or needs_fetch)
#   STATUS=new|existing|needs_title
#   NEEDS_FETCH=true       (only when GitHub fetch is required)

set -euo pipefail

ISSUES_FOLDER="${1:-}"
ARG_STRING="${2:-}"

[[ -n "$ISSUES_FOLDER" ]] || { echo "Usage: $0 <issues_folder> [arg_string]" >&2; exit 1; }

title_to_snake_case() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9]/_/g' \
    | sed 's/_\+/_/g' \
    | sed 's/^_//' \
    | sed 's/_$//'
}

find_existing_file() {
  find "$ISSUES_FOLDER" -maxdepth 1 \( -name "${1}_*" -o -name "${1}-*" \) 2>/dev/null | head -1
}

next_x_id() {
  local n=1 candidate existing
  while true; do
    candidate=$(printf "X%02d" "$n")
    existing=$(find_existing_file "$candidate")
    [[ -z "$existing" ]] && { echo "$candidate"; return; }
    (( n++ ))
  done
}

build_file() {
  echo "${ISSUES_FOLDER}/${1}_$(title_to_snake_case "$2").md"
}

title_from_filename() {
  local base
  base=$(basename "$1" .md)
  # Strip leading ID prefix (up to first _ or -)
  local title_part="${base#*_}"
  [[ "$title_part" == "$base" ]] && title_part="${base#*-}"
  echo "$title_part" | tr '_-' ' ' \
    | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2)); print}'
}

# --- Parse argument ---

ID="" TITLE="" SCENARIO=""

if [[ "$ARG_STRING" =~ ^#([^[:space:]]+)(.*) ]]; then
  ID="${BASH_REMATCH[1]}"
  REST="${BASH_REMATCH[2]}"
  REST="${REST## }"
  REST="${REST#- }"
  REST="${REST## }"
  TITLE="${REST//-/ }"
  TITLE="${TITLE## }" TITLE="${TITLE%% }"
  [[ -n "$TITLE" ]] && SCENARIO="A" || SCENARIO="C"
else
  SCENARIO="B"
  TITLE="${ARG_STRING## }" TITLE="${TITLE%% }"
fi

# --- Resolve ---

case "$SCENARIO" in
  A)
    EXISTING=$(find_existing_file "$ID")
    if [[ -n "$EXISTING" ]]; then
      printf 'SCENARIO=A\nID=%s\nTITLE=%s\nFILE=%s\nSTATUS=existing\n' "$ID" "$TITLE" "$EXISTING"
    elif [[ "$ID" =~ ^X ]]; then
      printf 'SCENARIO=A\nID=%s\nTITLE=%s\nFILE=%s\nSTATUS=new\n' "$ID" "$TITLE" "$(build_file "$ID" "$TITLE")"
    else
      printf 'SCENARIO=A\nID=%s\nTITLE=%s\nFILE=%s\nSTATUS=new\nNEEDS_FETCH=true\n' "$ID" "$TITLE" "$(build_file "$ID" "$TITLE")"
    fi
    ;;
  B)
    ID=$(next_x_id)
    if [[ -z "$TITLE" ]]; then
      printf 'SCENARIO=B\nID=%s\nTITLE=\nFILE=\nSTATUS=needs_title\n' "$ID"
    else
      printf 'SCENARIO=B\nID=%s\nTITLE=%s\nFILE=%s\nSTATUS=new\n' "$ID" "$TITLE" "$(build_file "$ID" "$TITLE")"
    fi
    ;;
  C)
    EXISTING=$(find_existing_file "$ID")
    if [[ -n "$EXISTING" ]]; then
      TITLE=$(title_from_filename "$EXISTING")
      printf 'SCENARIO=C\nID=%s\nTITLE=%s\nFILE=%s\nSTATUS=existing\n' "$ID" "$TITLE" "$EXISTING"
    elif [[ "$ID" =~ ^[0-9]+$ ]]; then
      printf 'SCENARIO=C\nID=%s\nTITLE=\nFILE=\nSTATUS=new\nNEEDS_FETCH=true\n' "$ID"
    else
      printf 'SCENARIO=C\nID=%s\nTITLE=\nFILE=\nSTATUS=needs_title\n' "$ID"
    fi
    ;;
esac
