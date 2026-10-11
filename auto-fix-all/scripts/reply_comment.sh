#!/usr/bin/env bash
# Thin engine_dispatch shim for the "auto-fix-all-reply-comment" migrated
# entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/256-migrate-auto-fix-all-reply-comment-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Posts an attributed reply comment on
# the current branch's PR and pushes the branch, via either the shell
# implementation (reply_comment_shell.sh) or the native one
# (core/bin/arcanum), per engine.mode / arcanum/_lib/migration-status.json.
#
# `HOME` is forwarded to the native path's explicit env-var allowlist —
# `gh auth token`/`gh auth switch` (used throughout the shell
# implementation) need it to resolve credentials once native's
# `env -i PATH="$PATH"` strips the ambient environment down; without it,
# native-mode auth would fail in a way shell-mode never does.
#
# Under engine.mode=docker it runs core/bin/arcanum inside the
# container, once its migration-status.json status is `"docker"` (#748),
# with the repo mount plus `--needs=global-config,gitconfig,gh,remote`:
# the global arcanum config ($CLAUDE_CONFIG_DIR/arcanum-config.json) and
# the global git config are mounted read-only, and a GitHub token
# resolved on the host is forwarded by name only as `-e GH_TOKEN` (`-e
# GH_HOST`/`-e GH_ENTERPRISE_TOKEN` on a GitHub Enterprise host), never
# as a value in argv. `remote` is needed for its git remote access
# (fetch/push): for an ssh origin the host's SSH agent socket and
# known_hosts are mounted (`SSH_AUTH_SOCK`/`GIT_SSH_COMMAND` forwarded);
# for an https origin the gh credential helper is configured so git
# authenticates with the forwarded GH_TOKEN. HOME stays in the allowlist
# for the native path. If docker is unavailable, engine_dispatch falls
# back to native on the host with a warning — see
# docs/agents/specs/docker/dispatch.md and
# docs/agents/specs/docker/environment.md.
#
# Usage: reply_comment.sh <repo_path> <id> <agent> <model_name> <model_email> <reply_body>
#
# Output and exit code: unchanged from before this migration — see
# reply_comment_shell.sh's own header for the full behavior contract.

set -euo pipefail

REPO_PATH="${1:-}"
ID="${2:-}"
AGENT="${3:-}"
MODEL_NAME="${4:-}"
MODEL_EMAIL="${5:-}"
REPLY_BODY="${6:-}"
ID="${ID#\#}"

usage() {
  echo "Usage: $0 <repo_path> <id> <agent> <model_name> <model_email> <reply_body>" >&2
  exit 1
}

[[ -n "$REPO_PATH" ]] || usage
[[ "$ID" =~ ^[0-9]+$ ]] || usage
[[ -n "$AGENT" && -n "$MODEL_NAME" && -n "$MODEL_EMAIL" && -n "$REPLY_BODY" ]] || usage

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" auto-fix-all-reply-comment "${SCRIPT_DIR}/reply_comment_shell.sh" --needs=global-config,gitconfig,gh,remote HOME -- "$@"
