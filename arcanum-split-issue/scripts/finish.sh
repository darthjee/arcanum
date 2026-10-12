#!/usr/bin/env bash
# Thin engine_dispatch shim for the "arcanum-split-issue-finish" migrated
# entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/255-migrate-arcanum-split-issue-finish-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Relabels the parent issue
# (Planning -> Split), deletes the local working files, and releases the
# working tree back to the configured safe branch, via either the shell
# implementation (finish_shell.sh) or the native one (core/bin/arcanum),
# per engine.mode / arcanum/_lib/migration-status.json.
#
# `HOME` is forwarded to the native path's explicit env-var allowlist —
# `gh` (invoked transitively via `github.sh mark-split`, both in shell mode
# and inside the native module) needs it to find its own config once
# `engine_dispatch` strips the ambient environment down for a native call.
#
# Under engine.mode=docker it runs core/bin/arcanum inside the
# container, now that its migration-status.json status is `"docker"`
# (#748), with the repo mount plus `--needs=global-config,gitconfig,gh,remote`:
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
# docs/agents/architecture/docker-engine.md#fallback-rules and
# docs/agents/architecture/docker-engine.md#environment.
#
# Usage: finish.sh <repo_path> <issue_id>
#
# Output and exit code: unchanged from before this migration — see
# finish_shell.sh's own header for the full Deleted:/BRANCH= contract.

set -euo pipefail

REPO_PATH="${1:-}"
ISSUE_ID="${2:-}"

[[ -n "$REPO_PATH" && -n "$ISSUE_ID" ]] || {
  echo "Usage: $0 <repo_path> <issue_id>" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" arcanum-split-issue-finish "${SCRIPT_DIR}/finish_shell.sh" --needs=global-config,gitconfig,gh,remote HOME -- "$@"
