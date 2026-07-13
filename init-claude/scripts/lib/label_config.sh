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
#   directories as needed. Returns 0 on success. This is the low-level
#   "replace the whole array" writer — used directly by the `replace`
#   subcommand of write_label_config.sh, and internally by
#   label_config_add/label_config_remove after they compute the new pair
#   list.
#
# label_config_ensure_defaults <config_path>
#   If <config_path> is missing/empty, or its "labels" array is
#   missing/null/empty, initializes it with DEFAULT_LABEL_PAIRS via
#   label_config_write. Otherwise a no-op. Always returns 0 (the defaults
#   are known-valid).
#
# label_config_read_pairs <config_path>
#   Prints the current config's entries as "<name>:<color>" lines, one per
#   label, in the order they appear in the "labels" array. If <config_path>
#   is missing, empty, or its "labels" array is missing/null/empty, prints
#   nothing. Always returns 0.
#
# label_config_remove <config_path> <name1> [<name2> ...]
#   Bare label names only (no ":color" suffix) — any argument containing a
#   ':' is a usage error: prints a message to stderr and returns 2 without
#   writing anything. Reads the existing config via label_config_read_pairs
#   (missing/empty file/array is treated as an empty list — a no-op, not an
#   error), filters out entries whose name matches any of the given names
#   (names not currently present are silently ignored), then writes the
#   remaining pairs back via label_config_write (even if that leaves the
#   array empty). Returns 0 on success.
#
# label_config_add <config_path> <name1:color1> [<name2:color2> ...]
#   Validates every pair first via label_config_validate_pair; on the first
#   invalid one, returns 2 without writing anything. Reads the existing
#   config via label_config_read_pairs (missing/empty is fine, starts from
#   an empty list), upserts each given pair by name — replacing the color in
#   place if the name already exists, appending it if it's new — then
#   writes the merged list back via label_config_write. Returns 0 on
#   success.

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
  Question:5319e7
  Fetched:bfd4f2
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

label_config_read_pairs() {
  local config_path="$1"

  if [[ ! -s "$config_path" ]] || ! jq -e '(.labels // []) | length > 0' "$config_path" >/dev/null 2>&1; then
    return 0
  fi

  jq -r '.labels[] | .name + ":" + .color' "$config_path"

  return 0
}

label_config_remove() {
  local config_path="$1"
  shift

  local name
  for name in "$@"; do
    if [[ "$name" == *:* ]]; then
      echo "Error: invalid label name '$name' — remove takes bare names, not <name>:<color> pairs" >&2
      return 2
    fi
  done

  local existing_pairs=()
  while IFS= read -r pair; do
    [[ -n "$pair" ]] || continue
    existing_pairs+=("$pair")
  done < <(label_config_read_pairs "$config_path")

  local remaining_pairs=()
  local pair existing_name skip found
  for pair in "${existing_pairs[@]+"${existing_pairs[@]}"}"; do
    existing_name="${pair%%:*}"
    found=0
    for name in "$@"; do
      if [[ "$existing_name" == "$name" ]]; then
        found=1
        break
      fi
    done
    [[ "$found" -eq 1 ]] || remaining_pairs+=("$pair")
  done

  label_config_write "$config_path" "${remaining_pairs[@]+"${remaining_pairs[@]}"}"

  return 0
}

label_config_add() {
  local config_path="$1"
  shift

  local pair
  for pair in "$@"; do
    label_config_validate_pair "$pair" || return 2
  done

  local existing_pairs=()
  while IFS= read -r existing_pair; do
    [[ -n "$existing_pair" ]] || continue
    existing_pairs+=("$existing_pair")
  done < <(label_config_read_pairs "$config_path")

  local new_name new_color existing_name i replaced
  for pair in "$@"; do
    new_name="${pair%%:*}"
    new_color="${pair#*:}"
    replaced=0

    for i in "${!existing_pairs[@]}"; do
      existing_name="${existing_pairs[$i]%%:*}"
      if [[ "$existing_name" == "$new_name" ]]; then
        existing_pairs[$i]="${new_name}:${new_color}"
        replaced=1
        break
      fi
    done

    [[ "$replaced" -eq 1 ]] || existing_pairs+=("${new_name}:${new_color}")
  done

  label_config_write "$config_path" "${existing_pairs[@]+"${existing_pairs[@]}"}"

  return 0
}
