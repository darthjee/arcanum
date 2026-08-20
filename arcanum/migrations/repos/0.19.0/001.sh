#!/usr/bin/env bash
# Migration 001 (next): prints a one-time, opt-in notice about the new
# engine.mode config key (arcanum/_lib/engine_dispatch.sh, #192/#193).
# Advisory only — no file changes, so it's trivially idempotent/safe to
# re-run. See 001.md for a human-readable summary.
#
# Usage: 001.sh config
#        001.sh run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cmd_config() {
  echo '{"skippable": true}'
}

cmd_run() {
  cat <<'EOF'
New, experimental & opt-in: engine.mode config key
----------------------------------------------------
arcanum can now dispatch some of its shell entrypoints to a native
(Node.js) implementation instead. This is EXPERIMENTAL and OPT-IN:
enabling engine.mode=native today only activates a native path for
resolve-and-fetch — every other entrypoint silently falls back to the
shell implementation regardless, per engine_dispatch.sh's fallback
rule. There is nothing to enable yet unless you want to try it early.

The key: "engine.mode" — values "shell" (default), "native", "docker"
(docker also falls back to shell today, out of scope for now).

Where to set it (resolved local -> repo -> global):
  Local (gitignored, per clone):
    .claude/state/arcanum-config.json -> {"engine": {"mode": "native"}}
  Repo (committed, shared):
    .claude/configuration/arcanum-repo-config.json ->
      {"engine": {"mode": "native"}}
  Global (account/machine-wide):
    ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json ->
      {"engine": {"mode": "native"}}
EOF
  exit 0
}

case "${1:-}" in
  config) cmd_config ;;
  run) cmd_run ;;
  *)
    echo "Usage: $0 {config|run}" >&2
    exit 1
    ;;
esac
