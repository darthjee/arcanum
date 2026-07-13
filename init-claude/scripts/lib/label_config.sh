# Shared label-config helpers for init-claude's setup_labels step.
#
# This file is meant to be SOURCED, not executed directly — it defines
# functions/globals used by scripts/sync_labels.sh and
# scripts/write_label_config.sh.
#
# --- Config file schema ---
#
# The label/color table is persisted as JSON at a path chosen by the caller
# (default: .claude/state/init-claude-config.json, relative to cwd):
#
#   {
#     "labels": [
#       { "name": "<label name>", "color": "<hex color, no leading '#'>" }
#     ]
#   }
#
# --- Functions ---
#
# label_config_validate_pair <pair>
#   Validates a single "<name>:<color>" pair (color = exactly 6 hex digits,
#   no leading '#'). On failure, prints a usage-style error to stderr and
#   returns 2. On success, returns 0. Does not exit — callers decide whether
#   to exit.
#
# label_config_write <config_path> <name1:color1> [<name2:color2> ...]
#   Validates every pair first; on the first invalid one, returns 2 without
#   writing anything. Otherwise builds the JSON above and writes it
#   atomically (tmp file + mv) to <config_path>, creating parent
#   directories as needed. Returns 0 on success.
#
# label_config_ensure_defaults <config_path>
#   If <config_path> is missing/empty, or its "labels" array is
#   missing/null/empty, initializes it with DEFAULT_LABEL_PAIRS via
#   label_config_write. Otherwise a no-op. Always returns 0 (the defaults
#   are known-valid).

DEFAULT_LABEL_CONFIG_PATH=".claude/state/init-claude-config.json"

DEFAULT_LABEL_PAIRS=(
  Bug:b60205
  Documentation:0075ca
  Enqueued:e8e639
  Feature:e9a20f
  Ready:247b61
  Refactor:983e7f
  shipit:0e8a16
  Created:024fa5
  Working:c314d7
)

label_config_validate_pair() {
  local pair="$1"

  if [[ "$pair" != *:* ]]; then
    echo "Error: invalid pair '$pair' — expected <label name>:<hex color>" >&2
    return 2
  fi

  local name="${pair%%:*}"
  local color="${pair#*:}"

  if [[ -z "$name" ]]; then
    echo "Error: invalid pair '$pair' — label name is empty" >&2
    return 2
  fi

  if [[ ! "$color" =~ ^[0-9A-Fa-f]{6}$ ]]; then
    echo "Error: invalid color '$color' for label '$name' — expected exactly 6 hex digits" >&2
    return 2
  fi

  return 0
}

label_config_write() {
  local config_path="$1"
  shift

  local pair
  for pair in "$@"; do
    label_config_validate_pair "$pair" || return 2
  done

  local json
  json=$(jq -n '{labels: []}')

  for pair in "$@"; do
    local name="${pair%%:*}"
    local color="${pair#*:}"
    json=$(jq --arg name "$name" --arg color "$color" \
      '.labels += [{name: $name, color: $color}]' <<< "$json")
  done

  mkdir -p "$(dirname "$config_path")"
  echo "$json" > "${config_path}.tmp"
  mv "${config_path}.tmp" "$config_path"

  return 0
}

label_config_ensure_defaults() {
  local config_path="$1"

  if [[ ! -s "$config_path" ]] || ! jq -e '(.labels // []) | length > 0' "$config_path" >/dev/null 2>&1; then
    label_config_write "$config_path" "${DEFAULT_LABEL_PAIRS[@]}"
  fi

  return 0
}
