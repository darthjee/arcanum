#!/usr/bin/env bash
# Thin engine_dispatch shim for the "init-claude-setup-docs-structure"
# migrated entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/593-migrate-init-claude-setup-docs-structure-to-native-node-js/plan.md
# for the full design/shared contracts. Creates the standard docs/agents/
# skeleton (issues/.gitkeep, plans/.gitkeep and the placeholder
# architecture.md, flow.md, issue-enhancement.md, arcanum-split-issue.md),
# skipping any path that already exists, and appends the standard
# "## Documentation" section to AGENTS.md when not already present, via
# either the shell implementation (setup_docs_structure_shell.sh) or the
# native one (core/bin/arcanum), per engine.mode /
# arcanum/_lib/migration-status.json.
#
# Usage: setup_docs_structure.sh
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
# entrypoint only writes static placeholder content.
#
# Output and exit code: unchanged from before this migration — prints
# "Created:" and/or "Already existed (skipped):" followed by one indented
# relative path per line, then an "AGENTS.md: ..." status line (omitted,
# with a warning on stderr, when AGENTS.md is missing); exits 0 (see
# setup_docs_structure_shell.sh).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"

REPO_PATH="$PWD"

engine_dispatch "$REPO_PATH" init-claude-setup-docs-structure "${SCRIPT_DIR}/setup_docs_structure_shell.sh" --prepend-repo-path -- "$@"
