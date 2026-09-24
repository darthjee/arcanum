#!/usr/bin/env bash
# Write ignored_check_patterns for the auto-fix-all namespace.
# Usage: set_ci_ignored_patterns.sh <pattern-1> [<pattern-2> ...]
#        set_ci_ignored_patterns.sh --clear
#   Run from the target project root (the repo being configured by
#   init-claude, not the arcanum install).
#
# Requires at least one pattern, or the literal --clear flag (which
# writes an empty array, clearing any previously configured patterns).
# Writes the full given list (replacing any existing value) as a JSON
# array under .claude/configuration/arcanum-repo-config.json's
# "auto-fix-all" namespace key, "ignored_check_patterns" field — via
# arcanum/_lib/repo_config.sh's repo_config_write (creating the file,
# and .claude/configuration/, if needed). Never writes to the legacy
# .claude/configuration/auto-fix-all.json file (it may still be read
# from, as a seed, if the new file doesn't have the namespace yet —
# see repo_config_write).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NEW_CONFIG_FILE=".claude/configuration/arcanum-repo-config.json"
LEGACY_CONFIG_FILE=".claude/configuration/auto-fix-all.json"
NAMESPACE="auto-fix-all"

# shellcheck source=../../arcanum/_lib/repo_config.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/repo_config.sh"

if [[ $# -eq 1 && "$1" == "--clear" ]]; then
  PATTERNS_JSON='[]'
elif [[ $# -lt 1 ]]; then
  echo "Usage: $0 <pattern-1> [<pattern-2> ...] | --clear" >&2
  exit 1
else
  PATTERNS_JSON="$(printf '%s\n' "$@" | jq -R . | jq -s -c .)"
fi

repo_config_write "$NEW_CONFIG_FILE" "$LEGACY_CONFIG_FILE" "$NAMESPACE" "ignored_check_patterns" "$PATTERNS_JSON"
