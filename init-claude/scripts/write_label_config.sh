#!/usr/bin/env bash
# Replace a label-config JSON file's labels array wholesale.
# Usage: write_label_config.sh <config_path> <Label1>:<color1> [<Label2>:<color2> ...]
#   config_path is mandatory (no default). Each pair is
#   <label name>:<hex color>, color without a leading '#' (e.g. Bug:b60205).
#
# Validates every pair before writing anything; on the first invalid pair,
# prints a usage-style error to stderr and exits 2 without touching the
# file. On success, writes the JSON schema documented in lib/label_config.sh
# to config_path (atomically) and exits 0.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/label_config.sh
source "${SCRIPT_DIR}/lib/label_config.sh"

usage() {
  echo "Usage: $0 <config_path> <Label1>:<color1> [<Label2>:<color2> ...]" >&2
  echo "  Each pair is <label name>:<hex color>, color without a leading '#' (e.g. Bug:b60205)." >&2
  exit 2
}

CONFIG_PATH="${1:-}"
[[ -n "$CONFIG_PATH" ]] || usage
shift

[[ $# -ge 1 ]] || usage

label_config_write "$CONFIG_PATH" "$@" || exit $?
