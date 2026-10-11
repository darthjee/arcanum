#!/usr/bin/env bash
# Thin engine_dispatch shim for the "auto-fix-issue-commit-change"
# migrated entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/428-migrate-auto-fix-issue-commit-change-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Commits changes already staged by
# a specialist agent, via either the shell implementation
# (commit_change_shell.sh) or the native one (core/bin/arcanum), per
# engine.mode / arcanum/_lib/migration-status.json.
#
# `HOME` is forwarded to the native path's explicit env-var allowlist —
# `git` (called throughout the shell implementation) needs it to resolve
# identity/config once native's `env -i PATH="$PATH"` strips the ambient
# environment down; without it, native-mode commits would fail in a way
# shell-mode never does.
#
# Under engine.mode=docker it runs core/bin/arcanum inside the
# container, once its migration-status.json status is `"docker"` (#748),
# with the repo mount plus `--needs=global-config,gitconfig,remote`: the
# global arcanum config ($CLAUDE_CONFIG_DIR/arcanum-config.json) and the
# global git config are mounted read-only. `remote` is needed for its
# git remote access (fetch/push): for an ssh origin the host's SSH agent
# socket and known_hosts are mounted (`SSH_AUTH_SOCK`/`GIT_SSH_COMMAND`
# forwarded); for an https origin the gh credential helper is configured
# and a GitHub token resolved on the host is forwarded by name only as
# `-e GH_TOKEN` (`-e GH_HOST`/`-e GH_ENTERPRISE_TOKEN` on a GitHub
# Enterprise host), never as a value in argv. HOME stays in the
# allowlist for the native path. If docker is unavailable,
# engine_dispatch falls back to native on the host with a warning — see
# docs/agents/specs/docker/dispatch.md and
# docs/agents/specs/docker/environment.md.
#
# Usage: commit_change.sh <repo_path> <type> <scope> <id> <subject> <agent> <model_name> <model_email> [body] [comment_url]
#
# Output and exit code: unchanged from before this migration — see
# commit_change_shell.sh's own header for the full behavior contract.

set -euo pipefail

REPO_PATH="${1:-}"
TYPE="${2:-}"
SCOPE="${3:-}"
ID="${4:-}"
SUBJECT="${5:-}"
AGENT="${6:-}"
MODEL_NAME="${7:-}"
MODEL_EMAIL="${8:-}"

[[ -n "$REPO_PATH" && -n "$TYPE" && -n "$SCOPE" && -n "$ID" && -n "$SUBJECT" && -n "$AGENT" && -n "$MODEL_NAME" && -n "$MODEL_EMAIL" ]] || {
  echo "Usage: $0 <repo_path> <type> <scope> <id> <subject> <agent> <model_name> <model_email> [body] [comment_url]" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" auto-fix-issue-commit-change "${SCRIPT_DIR}/commit_change_shell.sh" --needs=global-config,gitconfig,remote HOME -- "$@"
