#!/usr/bin/env bash
# Thin engine_dispatch shim for the "arcanum-check-config" entrypoint —
# see docs/agents/architecture/script-engine.md and
# docs/agents/plans/680-new-skill-arcanum-check-config-show-effective-config-value-and-its-source-tier-native-only/plan.md
# for the full design/shared contracts. Prints, as JSON, what each arcanum
# config tier (local -> repo -> global) holds for a dotted key, plus the
# final resolved value and the tier it came from.
#
# Native-only: this command has NO shell implementation (no *_shell.sh
# twin). It is listed in arcanum/_lib/migration-status.json with a
# non-`shell` status, but never falls back to a shell twin. It is
# dispatched with `engine_dispatch --native-only`, which always runs
# core/bin/arcanum (except engine.mode=docker, which errors out).
#
# `HOME` and `CLAUDE_CONFIG_DIR` are forwarded to the native path's
# explicit env-var allowlist — the global tier's file is resolved from
# them (`$CLAUDE_CONFIG_DIR`, then `$HOME/.claude`), and native's `env -i`
# would otherwise strip them.
#
# <repo_path> is forwarded as the first native argument, where the
# `context: 'repo'` dispatcher consumes it, so --prepend-repo-path is not
# used.
#
# Usage: check_config.sh <repo_path> <namespace.key[.sub...]>
#
# Output and exit code: passed through unchanged from core/bin/arcanum
# arcanum-check-config (JSON on stdout, exit 0; `arcanum: <message>` on
# stderr, exit 1, for a bad key) or from engine_dispatch's docker error.

set -euo pipefail

REPO_PATH="${1:-}"
KEY="${2:-}"

[[ -n "$REPO_PATH" && -n "$KEY" ]] || {
  echo "Usage: $0 <repo_path> <namespace.key[.sub...]>" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" arcanum-check-config "" --native-only HOME CLAUDE_CONFIG_DIR -- "$REPO_PATH" "$KEY"
