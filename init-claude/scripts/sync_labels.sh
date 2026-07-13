#!/usr/bin/env bash
# Print a label/color table, confirm interactively, then sync to GitHub.
# Usage: sync_labels.sh [<config_path>]
#   config_path defaults to lib/label_config.sh's DEFAULT_LABEL_CONFIG_PATH
#   (.claude/state/init-claude-config.json, relative to cwd).
#
# The label/color table is read from the JSON config file, schema:
#   { "labels": [ { "name": "<label name>", "color": "<hex, no '#'>" } ] }
# If the file is missing, empty, or its "labels" array is missing/empty,
# it is first initialized with the standard default labels (see
# lib/label_config.sh) before anything is printed or synced.
#
# Prints the table as markdown, then prompts on stdout:
#   Sync these labels to GitHub? [y/n]:
# Accepts y/yes/n/no (case-insensitive), re-prompting on anything else.
#
# On "yes": creates missing labels / updates colors of existing ones via
#   `gh label create` / `gh label edit`, prints STATUS=synced followed by
#   one CREATED=<name>/UPDATED=<name> line per label, exits 0.
# On "no": prints STATUS=discuss, exits 1, no GitHub calls made.
# On invalid/malformed config contents: prints a usage-style error to
#   stderr, exits 2.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../_lib/origin.sh
source "${SCRIPT_DIR}/../../_lib/origin.sh"
# shellcheck source=lib/label_config.sh
source "${SCRIPT_DIR}/lib/label_config.sh"

usage() {
  echo "Usage: $0 [<config_path>]" >&2
  echo "  config_path defaults to ${DEFAULT_LABEL_CONFIG_PATH}" >&2
  exit 2
}

CONFIG_PATH="${1:-$DEFAULT_LABEL_CONFIG_PATH}"

label_config_ensure_defaults "$CONFIG_PATH"

NAMES=()
COLORS=()

while IFS= read -r pair; do
  label_config_validate_pair "$pair" || usage

  NAMES+=("${pair%%:*}")
  COLORS+=("${pair#*:}")
done < <(jq -r '.labels[] | .name + ":" + .color' "$CONFIG_PATH")

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
