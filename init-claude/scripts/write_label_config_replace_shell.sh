#!/usr/bin/env bash
# Shell implementation of the "init-claude-write-label-config-replace"
# migrated entrypoint, dispatched by write_label_config.sh (the
# engine_dispatch shim, which owns all usage/arity validation — this file
# assumes a subcommand-specific valid argument list).
#
# Usage: write_label_config_replace_shell.sh <config_path> <Label1>:<color1> [<Label2>:<color2> ...]
#
#   Validates every pair before writing anything; on the first invalid
#   pair, prints a usage-style error to stderr and exits 2 without
#   touching the file. On success, replaces the config's whole "labels"
#   array with exactly the given pairs (atomically) and exits 0.
#
# Each pair is <label name>:<hex color>, color without a leading '#' (e.g.
# Bug:b60205). See lib/label_config.sh for the JSON schema and the
# underlying label_config_write function.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/label_config.sh
source "${SCRIPT_DIR}/lib/label_config.sh"

label_config_write "$1" "${@:2}" || exit $?
