#!/usr/bin/env bash
# Migration 001 (next): seed .claude/state/arcanum-config.json's
# "next_step"."auto.<skill>" keys (auto-next) for enhance-issue,
# discuss-issue and auto-plan-issue. A true key makes that skill skip
# its next-step offer and run the offered command as a chained run.
# Local, per-clone tier (highest precedence).
# See 001.md for a human-readable summary.
#
# Usage: 001.sh config
#        001.sh run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../../_lib/repo_config.sh
source "${SCRIPT_DIR}/../../../_lib/repo_config.sh"

NAMESPACE="next_step"

cmd_config() {
  echo '{"skippable": true}'
}

# write_auto <skill> <true|false>
#   Writes next_step.auto.<skill> = <true|false> into this migration's tier.
write_auto() {
  local skill="$1" value="$2"
  repo_config_write ".claude/state/arcanum-config.json" "" "$NAMESPACE" "auto.${skill}" "$value"
}

# prompt_skill <skill> <description>
#   Describes the offer <skill> would skip, then prompts
#   [Y]es/[N]o/[S]kip on /dev/tty. Y writes true, N writes false, and
#   any other answer writes nothing.
prompt_skill() {
  local skill="$1" description="$2"
  echo ""
  echo "${skill}: ${description}"
  printf '[Y]es/[N]o/[S]kip: '
  local choice
  read -r choice < /dev/tty
  case "$choice" in
    [Yy]*) write_auto "$skill" true ;;
    [Nn]*) write_auto "$skill" false ;;
    *)
      # Skip — nothing written; any lower-precedence tier (or the
      # default: always offer) still applies.
      ;;
  esac
}

cmd_run() {
  if ! ( exec 3< /dev/tty ) 2>/dev/null; then
    # No interactive terminal available (e.g. automated/CI-style runs) —
    # there is no derivable default to guess, so silently skip, writing
    # nothing. Every skill keeps offering its next step.
    return 0
  fi

  echo "Auto-next: when a skill's key is true, it skips its next-step offer"
  echo "and runs the offered command directly, as a chained run."
  echo "This sets it for this clone only (local tier, highest precedence)."
  echo "An explicit false here shadows a true set in a lower-precedence tier"
  echo "(the chain is local -> repo -> global). Skipping writes nothing."

  prompt_skill "enhance-issue" \
    "skip the /discuss-issue <id> offer (never applies to an Epic)"
  prompt_skill "discuss-issue" \
    "skip the /auto-plan-issue <id> offer"
  prompt_skill "auto-plan-issue" \
    "skip the /loop /auto-resolve-issue <id> offer once a plan exists"
}

case "${1:-}" in
  config) cmd_config ;;
  run) cmd_run ;;
  *)
    echo "Usage: $0 {config|run}" >&2
    exit 1
    ;;
esac
