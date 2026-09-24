#!/usr/bin/env bash
# Thin engine_dispatch shim for the "init-claude-set-ci-ignored-patterns"
# migrated entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/592-migrate-init-claude-set-ci-ignored-patterns-setup-templates-and-stamp-arcanum-version-to-native-node-js/plan.md
# for the full design/shared contracts. Writes ignored_check_patterns for
# the auto-fix-all namespace, via either the shell implementation
# (set_ci_ignored_patterns_shell.sh) or the native one (core/bin/arcanum),
# per engine.mode / arcanum/_lib/migration-status.json.
#
# Usage: set_ci_ignored_patterns.sh <pattern-1> [<pattern-2> ...]
#        set_ci_ignored_patterns.sh --clear
#   Run from the target project root.
#
# Like monitor-issues/scripts/config.sh, this entrypoint never took a
# <repo_path> argument: it is run from the target project root and the
# shell implementation writes relative to the current working directory.
# The literal "$PWD" (NOT `git rev-parse --show-toplevel`, which would
# break parity when run from a subdirectory or a non-git dir) is passed
# as engine_dispatch's <repo_path> with --prepend-repo-path, so only the
# native invocation receives it as its leading positional (the
# Dispatcher strips it into RepoContext.repoPath; native code never
# reads process.cwd() — see docs/agents/architecture/repo-path-threading.md),
# while the shell implementation's own args stay untouched.
#
# No env vars are forwarded to the native path's allowlist — this
# entrypoint only reads/writes config files under the target project.
#
# The zero-args usage check lives here, before engine_dispatch, so the
# error (message on stderr, exit 1) is identical in both modes.
#
# Output and exit code: unchanged from before this migration — see
# set_ci_ignored_patterns_shell.sh's own header for the full behavior
# contract.

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <pattern-1> [<pattern-2> ...] | --clear" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"

REPO_PATH="$PWD"

engine_dispatch "$REPO_PATH" init-claude-set-ci-ignored-patterns "${SCRIPT_DIR}/set_ci_ignored_patterns_shell.sh" --prepend-repo-path -- "$@"
