#!/usr/bin/env bash
# Mutate a label-config JSON file via one of three subcommands.
# Usage:
#   write_label_config.sh replace <config_path> <Label1>:<color1> [<Label2>:<color2> ...]
#   write_label_config.sh remove  <config_path> <Label1> [<Label2> ...]
#   write_label_config.sh add     <config_path> <Label1>:<color1> [<Label2>:<color2> ...]
#
#   config_path is mandatory (no default) for every subcommand.
#
#   replace: requires at least one <name>:<color> pair. Validates every
#     pair before writing anything; on the first invalid pair, prints a
#     usage-style error to stderr and exits 2 without touching the file.
#     On success, replaces the config's whole "labels" array with exactly
#     the given pairs (atomically) and exits 0.
#
#   remove: requires at least one bare <Label> name (no ":color" suffix —
#     any argument containing a ':' is rejected as a usage error, exit 2,
#     without touching the file). Removes entries matching the given names
#     from the config's "labels" array (names not currently present are
#     silently ignored); a missing/empty config is a no-op that still
#     succeeds. Writes the remaining array back (even if it ends up empty)
#     and exits 0.
#
#   add: requires at least one <name>:<color> pair, validated the same way
#     `replace` validates pairs (first invalid pair rejects before writing
#     anything, exit 2). Upserts each pair into the config's "labels" array
#     by name: replaces the color if the name already exists (preserving
#     its position), appends it if it's new. A missing/empty config starts
#     from an empty array. Writes the merged array back and exits 0.
#
# Each pair is <label name>:<hex color>, color without a leading '#' (e.g.
# Bug:b60205). See lib/label_config.sh for the JSON schema and the
# underlying label_config_write/label_config_remove/label_config_add
# functions. An unknown or missing subcommand is a usage error, exit 2.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/label_config.sh
source "${SCRIPT_DIR}/lib/label_config.sh"

usage() {
  echo "Usage: $0 replace <config_path> <Label1>:<color1> [<Label2>:<color2> ...]" >&2
  echo "       $0 remove  <config_path> <Label1> [<Label2> ...]" >&2
  echo "       $0 add     <config_path> <Label1>:<color1> [<Label2>:<color2> ...]" >&2
  echo "  Each pair is <label name>:<hex color>, color without a leading '#' (e.g. Bug:b60205)." >&2
  exit 2
}

SUBCOMMAND="${1:-}"
case "$SUBCOMMAND" in
  replace|remove|add)
    ;;
  *)
    usage
    ;;
esac
shift

CONFIG_PATH="${1:-}"
[[ -n "$CONFIG_PATH" ]] || usage
shift

[[ $# -ge 1 ]] || usage

case "$SUBCOMMAND" in
  replace)
    label_config_write "$CONFIG_PATH" "$@" || exit $?
    ;;
  remove)
    label_config_remove "$CONFIG_PATH" "$@" || exit $?
    ;;
  add)
    label_config_add "$CONFIG_PATH" "$@" || exit $?
    ;;
esac
