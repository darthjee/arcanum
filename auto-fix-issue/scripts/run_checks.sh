#!/usr/bin/env bash
# Run the check script for a given agent, if one exists
# Usage: run_checks.sh <agent>
#
# Looks for .claude/scripts/check_<agent>.sh relative to the current
# working directory (the target project's root, the same way other
# auto-fix-issue scripts assume cwd). If found, it is run via `bash`
# (rather than relying on its executable bit) so its stdout/stderr stream
# through normally, and this script exits with its exact exit code.
#
# If no check script exists for the agent, this is not a failure: it
# prints a message saying so and exits 0, since "no checks configured"
# must never look like a failure to the caller.

set -euo pipefail

AGENT="${1:-}"

[[ -n "$AGENT" ]] || {
  echo "Usage: $0 <agent>" >&2
  exit 1
}

CHECK_SCRIPT=".claude/scripts/check_${AGENT}.sh"

if [[ -f "$CHECK_SCRIPT" ]]; then
  bash "$CHECK_SCRIPT"
  exit $?
else
  echo "No checks configured for agent '${AGENT}' — skipping."
  exit 0
fi
