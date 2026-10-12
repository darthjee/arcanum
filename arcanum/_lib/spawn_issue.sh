#!/usr/bin/env bash
# Thin engine_dispatch shim for the "spawn-issue" migrated entrypoint —
# see docs/agents/architecture/script-engine.md and
# docs/agents/plans/239-migrate-spawn-issue-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Creates a brand-new GitHub issue
# on demand, tags/links it back to a parent issue, via either the shell
# implementation (spawn_issue_shell.sh) or the native one
# (core/bin/arcanum), per engine.mode / arcanum/_lib/migration-status.json.
#
# `HOME` is forwarded to the native path's explicit env-var allowlist —
# `gh` (called throughout the shell implementation) needs it to find its
# own config once native's `env -i PATH="$PATH"` strips the ambient
# environment down; without it, native-mode auth would fail in a way
# shell-mode never does.
#
# Under engine.mode=docker it runs core/bin/arcanum inside the
# container, now that its migration-status.json status is `"docker"` (#747),
# with the repo mount plus `--needs=global-config,gitconfig,gh`: the
# global arcanum config ($CLAUDE_CONFIG_DIR/arcanum-config.json) and the
# global git config are mounted read-only, and a GitHub token resolved
# on the host is forwarded by name only as `-e GH_TOKEN` (`-e
# GH_HOST`/`-e GH_ENTERPRISE_TOKEN` on a GitHub Enterprise host), never
# as a value in argv. `--path-arg=4:ro` additionally mounts <body_file>
# read-only at its own host path when it sits outside the repo. HOME
# stays in the allowlist for the native path. If docker is unavailable,
# engine_dispatch falls back to native on the host with a warning — see
# docs/agents/architecture/docker-engine.md#fallback-rules and
# docs/agents/architecture/docker-engine.md#environment.
#
# Usage: spawn_issue.sh <repo_path> <parent_id> <title> <body_file> [--as-subissue]
#
# Output and exit code: unchanged from before this migration — see
# spawn_issue_shell.sh's own header for the full
# STATUS=ok/ID=/URL=/STATUS=failed contract.

set -euo pipefail

REPO_PATH="${1:-}"
PARENT_ID="${2:-}"
TITLE="${3:-}"
BODY_FILE="${4:-}"

[[ -n "$REPO_PATH" && -n "$PARENT_ID" && -n "$TITLE" && -n "$BODY_FILE" ]] || {
  echo "Usage: $0 <repo_path> <parent_id> <title> <body_file> [--as-subissue]" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=engine_dispatch.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" spawn-issue "${SCRIPT_DIR}/spawn_issue_shell.sh" --needs=global-config,gitconfig,gh --path-arg=4:ro HOME -- "$@"
