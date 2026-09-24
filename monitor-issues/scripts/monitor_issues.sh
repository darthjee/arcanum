#!/usr/bin/env bash
# Thin engine_dispatch shim for the "monitor-issues-monitor-issues"
# migrated entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/586-migrate-monitor-issues-entrypoints-to-native-node-js/plan.md
# for the full design/shared contracts. Continuous issue monitor for the
# target repository, via either the shell implementation
# (monitor_issues_shell.sh) or the native one (core/bin/arcanum), per
# engine.mode / arcanum/_lib/migration-status.json.
#
# `HOME` is forwarded to the native path's env-var allowlist (gh auth /
# config resolution).
#
# Runs forever; stop with Ctrl-C or SIGTERM. engine_dispatch runs the
# chosen implementation as a child process (it does not exec), so this
# shim runs it in the background and forwards INT/TERM/HUP to it as
# SIGTERM — otherwise a SIGTERM sent to this shim's pid alone would leave
# the poll loop (shell or core/bin/arcanum) running as an orphan. SIGTERM
# (not SIGINT) is forwarded because background children of a
# non-interactive shell start with SIGINT ignored. The shell
# implementation's EXIT trap still releases its lock on SIGTERM.
#
# Usage: monitor_issues.sh <repo_path>

set -uo pipefail

REPO_PATH="${1:?Usage: monitor_issues.sh <repo_path>}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"

DISPATCH_PID=""

# Sends SIGTERM to the backgrounded engine_dispatch subshell and to its
# direct children (the actual shell/native implementation).
# shellcheck disable=SC2329 # invoked via the trap below
_forward_termination() {
  [[ -n "$DISPATCH_PID" ]] || return 0
  if command -v pkill >/dev/null 2>&1; then
    pkill -TERM -P "$DISPATCH_PID" 2>/dev/null || true
  fi
  kill -TERM "$DISPATCH_PID" 2>/dev/null || true
}

trap '_forward_termination' INT TERM HUP

engine_dispatch "$REPO_PATH" monitor-issues-monitor-issues "${SCRIPT_DIR}/monitor_issues_shell.sh" HOME -- "$REPO_PATH" &
DISPATCH_PID=$!

# `wait` returns early (status > 128) whenever a trapped signal arrives;
# keep waiting until the child has really exited, then propagate its code.
STATUS=0
while true; do
  wait "$DISPATCH_PID"
  STATUS=$?
  kill -0 "$DISPATCH_PID" 2>/dev/null || break
done
exit "$STATUS"
