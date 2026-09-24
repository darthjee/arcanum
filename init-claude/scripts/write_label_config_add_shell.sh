#!/usr/bin/env bash
# Shell implementation of the "init-claude-write-label-config-add"
# migrated entrypoint, dispatched by write_label_config.sh (the
# engine_dispatch shim, which owns all usage/arity validation — this file
# assumes a subcommand-specific valid argument list).
#
# Usage: write_label_config_add_shell.sh <config_path> <Label1>:<color1> [<Label2>:<color2> ...]
#
#   Pairs are validated the same way `replace` validates them (first
#   invalid pair rejects before writing anything, exit 2). Upserts each
#   pair into the config's "labels" array by name: replaces the color if
#   the name already exists (preserving its position), appends it if it's
#   new. A missing/empty config starts from an empty array. Writes the
#   merged array back and exits 0.
#
# Each pair is <label name>:<hex color>, color without a leading '#' (e.g.
# Bug:b60205). See lib/label_config.sh for the JSON schema and the
# underlying label_config_add function.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/label_config.sh
source "${SCRIPT_DIR}/lib/label_config.sh"

label_config_add "$1" "${@:2}" || exit $?
