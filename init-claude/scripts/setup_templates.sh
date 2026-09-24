#!/usr/bin/env bash
# Thin engine_dispatch shim for the "init-claude-setup-templates" migrated
# entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/592-migrate-init-claude-set-ci-ignored-patterns-setup-templates-and-stamp-arcanum-version-to-native-node-js/plan.md
# for the full design/shared contracts. Copies the init-claude .github
# templates (pull_request_template.md, commit_message_template.md,
# commit_message_template-2.0.md) into the target project's .github/,
# leaving already-present files untouched, via either the shell
# implementation (setup_templates_shell.sh) or the native one
# (core/bin/arcanum), per engine.mode / arcanum/_lib/migration-status.json.
#
# Usage: setup_templates.sh
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
# entrypoint only copies static templates from this install.
#
# Output and exit code: unchanged from before this migration — prints
# "Created: <names>" and/or "Already present, left untouched: <names>",
# exits 0 (see setup_templates_shell.sh).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"

REPO_PATH="$PWD"

engine_dispatch "$REPO_PATH" init-claude-setup-templates "${SCRIPT_DIR}/setup_templates_shell.sh" --prepend-repo-path -- "$@"
