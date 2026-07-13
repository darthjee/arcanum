#!/usr/bin/env bash
# Print a label/color table, confirm interactively, then sync to GitHub.
# Usage: sync_labels.sh <Label1>:<color1> [<Label2>:<color2> ...]
#   Each argument is <label name>:<hex color> (color without a leading '#',
#   e.g. Bug:b60205). Every entry must have a color.
#
# Prints the table as markdown, then prompts on stdout:
#   Sync these labels to GitHub? [y/n]:
# Accepts y/yes/n/no (case-insensitive), re-prompting on anything else.
#
# On "yes": creates missing labels / updates colors of existing ones via
#   `gh label create` / `gh label edit`, prints STATUS=synced followed by
#   one CREATED=<name>/UPDATED=<name> line per label, exits 0.
# On "no": prints STATUS=discuss, exits 1, no GitHub calls made.
# On invalid arguments: prints a usage error to stderr, exits 2.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../_lib/origin.sh
source "${SCRIPT_DIR}/../../_lib/origin.sh"

usage() {
  echo "Usage: $0 <Label1>:<color1> [<Label2>:<color2> ...]" >&2
  echo "  Each pair is <label name>:<hex color>, color without a leading '#' (e.g. Bug:b60205)." >&2
  exit 2
}

[[ $# -ge 1 ]] || usage

NAMES=()
COLORS=()

for pair in "$@"; do
  if [[ "$pair" != *:* ]]; then
    echo "Error: invalid pair '$pair' — expected <label name>:<hex color>" >&2
    usage
  fi

  name="${pair%%:*}"
  color="${pair#*:}"

  if [[ -z "$name" ]]; then
    echo "Error: invalid pair '$pair' — label name is empty" >&2
    usage
  fi

  if [[ ! "$color" =~ ^[0-9A-Fa-f]{6}$ ]]; then
    echo "Error: invalid color '$color' for label '$name' — expected exactly 6 hex digits" >&2
    usage
  fi

  NAMES+=("$name")
  COLORS+=("$color")
done

# --- Print the table ---

echo "| Label | Color |"
echo "| --- | --- |"
for i in "${!NAMES[@]}"; do
  echo "| ${NAMES[$i]} | #${COLORS[$i]} |"
done

# --- Prompt for confirmation ---

answer=""
while true; do
  printf 'Sync these labels to GitHub? [y/n]: '
  if ! read -r answer; then
    echo "Error: no input available for confirmation prompt" >&2
    exit 2
  fi

  case "$(printf '%s' "$answer" | tr '[:upper:]' '[:lower:]')" in
    y|yes)
      break
      ;;
    n|no)
      echo "STATUS=discuss"
      exit 1
      ;;
    *)
      continue
      ;;
  esac
done

# --- Sync to GitHub ---

REPO=$(get_repo_ref)

EXISTING=$(gh label list -R "$REPO" --json name -q '.[].name')

echo "STATUS=synced"

for i in "${!NAMES[@]}"; do
  name="${NAMES[$i]}"
  color="${COLORS[$i]}"

  if grep -qxF "$name" <<< "$EXISTING"; then
    gh label edit "$name" -R "$REPO" --color "$color" >/dev/null
    echo "UPDATED=$name"
  else
    gh label create "$name" -R "$REPO" --color "$color" >/dev/null
    echo "CREATED=$name"
  fi
done
