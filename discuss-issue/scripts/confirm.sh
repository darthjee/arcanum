#!/usr/bin/env bash
# Thin engine_dispatch shim for the "discuss-issue-confirm" migrated
# entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/447-migrate-discuss-issue-confirm-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Deterministically resolves a
# free-form yes/no-ish reply to a boolean (exit code only, no stdout),
# via either the shell implementation (confirm_shell.sh) or the native
# one (core/bin/arcanum), per engine.mode / arcanum/_lib/migration-status.json.
#
# No env vars are forwarded to the native path's allowlist — this
# entrypoint does no git/GitHub/filesystem I/O, only string
# normalization on its one argument.
#
# Usage: confirm.sh "<free-form reply>"
#
# Unlike commit_change.sh/merge_main.sh, this entrypoint does not take
# <repo_path> as its own argument — every existing caller invokes it as
# `confirm.sh "<reply>"`. engine_dispatch() still needs a repo_path for
# its config_chain_read call, so it is derived here from the ambient git
# checkout, the same convention list_plan_agents.sh uses.
#
# Output and exit code: unchanged from before this migration — see
# confirm_shell.sh's own header for the full behavior contract. Note
# there is deliberately NO argument-presence check here (unlike most
# other shims): confirm_shell.sh itself never errors or prints anything
# on a missing/empty reply, it just exits 1 the same as any other
# non-affirmative reply — adding a validation block here would diverge
# from that contract.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"

REPO_PATH="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

engine_dispatch "$REPO_PATH" discuss-issue-confirm "${SCRIPT_DIR}/confirm_shell.sh" -- "$@"
