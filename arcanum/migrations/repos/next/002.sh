#!/usr/bin/env bash
# Migration 002 (next): warn-only. #907 widened git.safe_branch,
# auto-fix-all.clear_context, auto-fix-all.finish_on_empty_queue and
# monitor-issues.clear_context to the global tier, so a value for any of
# them in the global config file, ignored until now, starts taking
# effect. For each such value present and not null, prints one warning
# to stderr naming it and how to remove it. Never writes any file and
# always exits 0. See 002.md for a human-readable summary.
#
# Usage: 002.sh config
#        002.sh run

set -euo pipefail

# Paths come from this script's own location, never from the cwd. The
# depth holds after bump-version.sh renames next/.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../../_lib/global_config.sh
source "${SCRIPT_DIR}/../../../_lib/global_config.sh"

TIER="global"
KEYS=(
  "git.safe_branch"
  "auto-fix-all.clear_context"
  "auto-fix-all.finish_on_empty_queue"
  "monitor-issues.clear_context"
)

cmd_config() {
  echo '{"skippable": true}'
}

# warn_key <file> <key>
#   Prints the warning for <key> (a dot-separated path) when it is present
#   in <file> and not null. Prints nothing otherwise.
warn_key() {
  local file="$1" key="$2" value
  value="$(jq -c --arg k "$key" \
    '($k | split(".")) as $p | (try getpath($p) catch null) | select(. != null)' \
    "$file" 2>/dev/null || true)"
  [[ -n "$value" ]] || return 0
  echo "Warning: ${key} = ${value} in ${file} now takes effect (arcanum reads it from the ${TIER} tier). Remove it with: arcanum config unset ${key} --${TIER}" >&2
}

cmd_run() {
  local file key
  file="$(_global_config_file)"
  [[ -n "$file" && -f "$file" ]] || return 0

  if ! jq -e 'type == "object"' "$file" >/dev/null 2>&1; then
    echo "Warning: could not read ${file} (not a valid JSON object); skipped checking it for values that now take effect in the ${TIER} tier." >&2
    return 0
  fi

  for key in "${KEYS[@]}"; do
    warn_key "$file" "$key"
  done
  return 0
}

case "${1:-}" in
  config) cmd_config ;;
  run) cmd_run ;;
  *)
    echo "Usage: $0 {config|run}" >&2
    exit 1
    ;;
esac
