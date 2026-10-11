#!/usr/bin/env bash
# Thin engine_dispatch shim for the "init-claude-stamp-arcanum-version"
# migrated entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/592-migrate-init-claude-set-ci-ignored-patterns-setup-templates-and-stamp-arcanum-version-to-native-node-js/plan.md
# for the full design/shared contracts. Stamps this arcanum install's
# version into the target project's committed and local config pointers,
# via either the shell implementation (stamp_arcanum_version_shell.sh) or
# the native one (core/bin/arcanum), per engine.mode /
# arcanum/_lib/migration-status.json.
#
# Usage: stamp_arcanum_version.sh
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
# HOME is forwarded to the native path's explicit env-var allowlist —
# resolving a git-clone install's version runs `git describe`, which
# needs it to resolve git config once native's `env -i PATH="$PATH"`
# strips the ambient environment down (same reasoning as
# auto-new-issue/scripts/commit_issue.sh).
#
# Under engine.mode=docker it runs core/bin/arcanum inside the container,
# once its migration-status.json status is `"docker"` (#746), with the
# repo mount plus `--needs=global-config`: the global arcanum config
# ($CLAUDE_CONFIG_DIR/arcanum-config.json) is mounted read-only when it
# exists. HOME stays in the allowlist for the native path; under docker
# the version comes from the image's own arcanum.json instead. If docker
# is unavailable, engine_dispatch falls back to native on the host with
# a warning — see docs/agents/specs/docker/dispatch.md.
#
# Output and exit code: unchanged from before this migration — no
# output, always exits 0; see stamp_arcanum_version_shell.sh's own
# header for the full behavior contract.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"

REPO_PATH="$PWD"

engine_dispatch "$REPO_PATH" init-claude-stamp-arcanum-version "${SCRIPT_DIR}/stamp_arcanum_version_shell.sh" --prepend-repo-path --needs=global-config HOME -- "$@"
