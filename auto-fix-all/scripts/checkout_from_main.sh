#!/usr/bin/env bash
# Thin engine_dispatch shim for the "auto-fix-all-checkout-from-main"
# migrated entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/258-migrate-auto-fix-all-checkout-from-main-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Bootstraps or reuses the
# "issue-<id>" branch merged up to date with "origin/main", via either the
# shell implementation (checkout_from_main_shell.sh) or the native one
# (core/bin/arcanum), per engine.mode / arcanum/_lib/migration-status.json.
#
# Purely filesystem/git-based — no environment dependency, so no extra
# env-var allowlist entries (beyond PATH, which engine_dispatch always
# includes) are needed for the native path.
#
# Under engine.mode=docker it runs core/bin/arcanum inside the
# container, now that its migration-status.json status is `"docker"`
# (#748), with the repo mount plus `--needs=gitconfig,remote`: the global git
# config is mounted read-only (its git operations need the user's git
# identity and config). `remote` is needed for its `git fetch`: for an
# ssh origin the host's SSH agent socket and known_hosts are mounted
# (`SSH_AUTH_SOCK`/`GIT_SSH_COMMAND` forwarded); for an https origin the
# gh credential helper is configured and a GitHub token resolved on the
# host is forwarded by name only as `-e GH_TOKEN` (`-e GH_HOST`/`-e
# GH_ENTERPRISE_TOKEN` on a GitHub Enterprise host), never as a value in
# argv. If docker is unavailable, engine_dispatch falls back to native
# on the host with a warning — see docs/agents/specs/docker/dispatch.md
# and docs/agents/specs/docker/environment.md.
#
# Usage: checkout_from_main.sh <repo_path> <id>
#
# Output and exit code: unchanged from before this migration — see
# checkout_from_main_shell.sh's own header for the full contract.

set -euo pipefail

REPO_PATH="${1:-}"
ID="${2:-}"

[[ -n "$REPO_PATH" && -n "$ID" ]] || { echo "Usage: $0 <repo_path> <id>" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" auto-fix-all-checkout-from-main "${SCRIPT_DIR}/checkout_from_main_shell.sh" --needs=gitconfig,remote -- "$@"
