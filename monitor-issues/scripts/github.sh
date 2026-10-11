#!/usr/bin/env bash
# Thin per-subcommand engine_dispatch shim for the
# "monitor-issues-github-*" migrated entrypoints — see
# docs/agents/architecture/script-engine.md and
# docs/agents/plans/586-migrate-monitor-issues-entrypoints-to-native-node-js/plan.md
# for the full design/shared contracts. GitHub operations for
# monitor-issues, via either the shell implementation
# (github_<subcommand>_shell.sh) or the native one (core/bin/arcanum), per
# engine.mode / arcanum/_lib/migration-status.json.
#
# `HOME` is forwarded to the native path's env-var allowlist (gh auth /
# config resolution).
#
# Under engine.mode=docker `remove-tag` runs core/bin/arcanum inside the
# container, now that its migration-status.json status is `"docker"` (#747),
# with the repo mount plus `--needs=global-config,gitconfig,gh`: the
# global arcanum config ($CLAUDE_CONFIG_DIR/arcanum-config.json) and the
# global git config are mounted read-only, and a GitHub token resolved
# on the host is forwarded by name only as `-e GH_TOKEN` (`-e
# GH_HOST`/`-e GH_ENTERPRISE_TOKEN` on a GitHub Enterprise host), never
# as a value in argv. HOME stays in the allowlist for the native path.
# If docker is unavailable, engine_dispatch falls back to native on the
# host with a warning — see docs/agents/specs/docker/dispatch.md and
# docs/agents/specs/docker/environment.md.
#
# Usage: github.sh <command> <repo_path> [args]
#   remove-tag <repo_path> <id> <tag>   Remove a single tag from GitHub issue <id>,
#                                       mapped to a real GitHub label via the
#                                       canonical-tag/label-name table in `arcanum/_lib/tags.sh`.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"

case "${1:-}" in
  remove-tag)
    shift
    # Validated here (same message as before the migration) so
    # engine_dispatch never runs with an empty <repo_path>.
    [[ -n "${1:-}" && -n "${2:-}" && -n "${3:-}" ]] || {
      echo "Usage: $0 remove-tag <repo_path> <id> <tag>" >&2
      exit 1
    }
    engine_dispatch "$1" monitor-issues-github-remove-tag "${SCRIPT_DIR}/github_remove_tag_shell.sh" --needs=global-config,gitconfig,gh HOME -- "$@"
    ;;
  *)
    echo "Usage: $0 <command> <repo_path> [args]" >&2
    echo "Commands:" >&2
    echo "  remove-tag <repo_path> <id> <tag>   Remove a single tag from GitHub issue <id>, mapped to a real GitHub label via arcanum/_lib/tags.sh" >&2
    exit 1
    ;;
esac
