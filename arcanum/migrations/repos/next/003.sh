#!/usr/bin/env bash
# Migration 003 (next): warn-only. #907 widened
# auto-fix-all.ignored_check_patterns to the local tier, so a value for it
# in the repo-local .claude/state/arcanum-config.json, ignored until now,
# starts overriding the committed repo value. When that value is present
# and not null, prints one warning to stderr naming it and how to remove
# it. Never writes any file and always exits 0. See 003.md for a
# human-readable summary.
#
# Usage: 003.sh config
#        003.sh run

set -euo pipefail

# Relative to the cwd, which the migration runner sets to the target repo.
LOCAL_CONFIG_FILE=".claude/state/arcanum-config.json"
TIER="local"
KEYS=(
  "auto-fix-all.ignored_check_patterns"
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
  echo "Warning: ${key} = ${value} in ${file} now overrides the repo value (arcanum reads it from the ${TIER} tier). Remove it with: arcanum config unset ${key} --${TIER}" >&2
}

cmd_run() {
  local file="$LOCAL_CONFIG_FILE" key
  [[ -f "$file" ]] || return 0

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
