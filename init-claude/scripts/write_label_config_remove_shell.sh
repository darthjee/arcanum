#!/usr/bin/env bash
# Shell implementation of the "init-claude-write-label-config-remove"
# migrated entrypoint, dispatched by write_label_config.sh (the
# engine_dispatch shim, which owns all usage/arity validation — this file
# assumes a subcommand-specific valid argument list).
#
# Usage: write_label_config_remove_shell.sh <config_path> <Label1> [<Label2> ...]
#
#   Takes bare <Label> names (no ":color" suffix — any argument
#   containing a ':' is rejected as a usage error, exit 2, without
#   touching the file). Removes entries matching the given names from the
#   config's "labels" array (names not currently present are silently
#   ignored); a missing/empty config is a no-op that still succeeds.
#   Writes the remaining array back (even if it ends up empty) and exits 0.
#
# See lib/label_config.sh for the JSON schema and the underlying
# label_config_remove function.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/label_config.sh
source "${SCRIPT_DIR}/lib/label_config.sh"

label_config_remove "$1" "${@:2}" || exit $?
