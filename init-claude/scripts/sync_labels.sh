#!/usr/bin/env bash
# Thin engine_dispatch shim for the "init-claude-sync-labels" migrated
# entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/594-migrate-init-claude-label-commands-write-label-config-sync-labels-to-native-node-js/plan.md
# for the full design/shared contracts. Prints a label/color table,
# confirms interactively, then syncs the labels to GitHub, via either
# the shell implementation (sync_labels_shell.sh) or the native one
# (core/bin/arcanum), per engine.mode / arcanum/_lib/migration-status.json.
#
# Usage: sync_labels.sh <repo_path> [<config_path>]
#   repo_path is required — the local checkout path of the target repo,
#   used to resolve origin explicitly rather than trusting ambient cwd.
#   config_path defaults to .claude/state/init-claude-config.json
#   (relative to cwd).
#
# Context: `context: 'repo'`, taken from this entrypoint's own existing
# leading <repo_path> positional — so <repo_path> is passed as the first
# element of the dispatched args (the shell implementation takes it too),
# and --prepend-repo-path is NOT used.
#
# <config_path> is made absolute against $PWD here (left as-is when it
# already starts with '/'), so both implementations receive the same
# absolute path regardless of <repo_path> (issue #594).
#
# Env allowlist: HOME only — the native path needs it for `gh auth token`
# (GitHub credential lookup).
#
# stdin is passed through untouched to both implementations: the y/n
# confirmation prompt is answered on stdin in either mode.
#
# Known, accepted divergence: engine_dispatch cd's into <repo_path> to
# read engine.mode, so a non-existent <repo_path> now fails before the
# table is printed, whereas before this migration it failed only after
# the prompt, at get_repo_ref.
#
# Output and exit code: otherwise unchanged from before this migration —
# see sync_labels_shell.sh's own header for the full behavior contract.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"

REPO_PATH="${1:?Usage: $0 <repo_path> [<config_path>]}"
# Mirrors lib/label_config.sh's DEFAULT_LABEL_CONFIG_PATH (hardcoded here
# so the shim doesn't need to source label_config.sh) — keep in sync.
CONFIG_PATH="${2:-.claude/state/init-claude-config.json}"

if [[ "$CONFIG_PATH" == /* ]]; then
  ABS_CONFIG_PATH="$CONFIG_PATH"
else
  ABS_CONFIG_PATH="$PWD/$CONFIG_PATH"
fi

engine_dispatch "$REPO_PATH" init-claude-sync-labels "${SCRIPT_DIR}/sync_labels_shell.sh" HOME -- "$REPO_PATH" "$ABS_CONFIG_PATH"
