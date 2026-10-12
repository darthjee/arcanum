#!/usr/bin/env bash
# Thin engine_dispatch shim for the "arcanum-split-issue-push-sub-issues"
# migrated entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/260-migrate-arcanum-split-issue-push-sub-issues-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Pushes every generated sub-issue
# draft file for an issue to GitHub, in ascending count order, via either
# the shell implementation (push_sub_issues_shell.sh) or the native one
# (core/bin/arcanum), per engine.mode / arcanum/_lib/migration-status.json.
#
# HOME is forwarded to the native path's explicit env-var allowlist — the
# native implementation calls ArcanumSplitIssueCreateSubIssue in-process
# for each file (whose own call chain reaches SpawnIssue -> `gh auth
# token`) and needs it to resolve credentials once native's
# `env -i PATH="$PATH"` strips the ambient environment; mirrors
# create_sub_issue.sh's own shim.
#
# Under engine.mode=docker it runs core/bin/arcanum inside the
# container, now that its migration-status.json status is `"docker"` (#747),
# with the repo mount plus `--needs=global-config,gitconfig,gh`: the
# global arcanum config ($CLAUDE_CONFIG_DIR/arcanum-config.json) and the
# global git config are mounted read-only, and a GitHub token resolved
# on the host is forwarded by name only as `-e GH_TOKEN` (`-e
# GH_HOST`/`-e GH_ENTERPRISE_TOKEN` on a GitHub Enterprise host), never
# as a value in argv. HOME stays in the allowlist for the native path.
# If docker is unavailable, engine_dispatch falls back to native on the
# host with a warning — see docs/agents/architecture/docker-engine.md#fallback-rules and
# docs/agents/architecture/docker-engine.md#environment.
#
# Usage: push_sub_issues.sh <repo_path> <issue_id>
#
# Output and exit code: unchanged from before this migration — see
# push_sub_issues_shell.sh's own header for the full STATUS=ok/
# CREATED=.../STATUS=failed/FAILED=... contract.

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
engine_dispatch "$REPO_PATH" arcanum-split-issue-push-sub-issues "${SCRIPT_DIR}/push_sub_issues_shell.sh" --needs=global-config,gitconfig,gh HOME -- "$@"
