#!/usr/bin/env bash
# Thin engine_dispatch shim for the "auto-monitor-pr-monitor-pr" migrated
# entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/436-migrate-auto-monitor-pr-monitor-pr-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Single-pass check for
# merge/close/approval/new-owner-comments on a PR, via either the shell
# implementation (monitor_pr_shell.sh) or the native one (core/bin/arcanum),
# per engine.mode / arcanum/_lib/migration-status.json.
#
# `HOME` is forwarded to the native path's explicit env-var allowlist —
# needed for `gh`/token resolution once native's `env -i PATH="$PATH"`
# strips the ambient environment, same rationale as resolve_pr_number.sh
# and run_checks.sh.
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
# docs/agents/specs/docker/dispatch.md and
# docs/agents/specs/docker/environment.md.
#
# Usage: monitor_pr.sh <repo_path> --pr-number <pr_number> [--issue-id <id>]
#
# Output and exit code: unchanged from before this migration — see
# monitor_pr_shell.sh's own header for the full behavior contract.

set -euo pipefail

REPO_PATH="${1:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" auto-monitor-pr-monitor-pr "${SCRIPT_DIR}/monitor_pr_shell.sh" --needs=global-config,gitconfig,gh,remote HOME -- "$@"
