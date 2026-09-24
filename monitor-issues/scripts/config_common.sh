#!/usr/bin/env bash
# Shared constants/helpers for monitor-issues' config_<subcommand>_shell.sh
# scripts (config_get_shell.sh, config_is_enabled_shell.sh,
# config_set_shell.sh, config_toggle_shell.sh) — factored out of the old
# single config.sh so none of the 4 scripts duplicate them.
#
# All paths are relative to the caller's cwd (the target project's root),
# exactly as the pre-migration config.sh resolved them.
#
# This file is meant to be SOURCED, not executed directly.

CONFIG_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE=".claude/configuration/monitor-issues.json"
STATE_CONFIG_FILE=".claude/state/monitor-issues-config.json"
# shellcheck disable=SC2034
# Read by _acquire_lock/_release_lock (lock.sh, sourced below), called by
# config_set_shell.sh / config_toggle_shell.sh
LOCK_FILE=".claude/state/monitor-issues-config.lock"
STATE_DIR=".claude/state"

mkdir -p "$STATE_DIR"

# shellcheck source=../../arcanum/_lib/lock.sh
source "${CONFIG_COMMON_DIR}/../../arcanum/_lib/lock.sh"

# Returns the file that a given key should be read from/written to:
# clear_context is personal, frequently-toggled state and lives in the
# gitignored STATE_CONFIG_FILE; every other key lives in the committed
# CONFIG_FILE.
_config_file_for_key() {
  [[ "$1" == "clear_context" ]] && echo "$STATE_CONFIG_FILE" || echo "$CONFIG_FILE"
}

# Reads the config object from the given file, or "{}" if absent/empty.
_read_config() {
  local f="$1"
  if [[ -s "$f" ]]; then
    cat "$f"
  else
    echo "{}"
  fi
}
