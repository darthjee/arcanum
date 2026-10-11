#!/usr/bin/env bash
# Thin engine_dispatch shim for the "resolve-and-fetch" migrated
# entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/193-migrate-resolve-and-fetch-sh-to-a-native--node-js--implementation/plan.md
# for the full design/shared contracts. Resolves an issue id
# ('<id>' or '#<id>') and guarantees its content exists locally,
# fetching from GitHub when needed, via either the shell implementation
# (resolve_and_fetch_shell.sh) or the native one (core/bin/arcanum),
# per engine.mode / arcanum/_lib/migration-status.json.
#
# `HOME` is forwarded to the native path's explicit env-var allowlist —
# `gh auth token` (called deeper in the shell implementation via
# github_issue.sh) needs it to find its own config once native's
# `env -i PATH="$PATH"` strips the ambient environment down; without it,
# native-mode auth would fail in a way shell-mode never does. Under
# docker, HOME's gh config is not mounted: the token is resolved on the
# host and forwarded as GH_TOKEN, which `gh auth token` inside the
# container returns (see below).
#
# Under engine.mode=docker it runs core/bin/arcanum inside the
# container, now that its migration-status.json status is `"docker"` (#747),
# with the repo mount plus `--needs=global-config,gitconfig,gh,remote`:
# the global arcanum config ($CLAUDE_CONFIG_DIR/arcanum-config.json) and
# the global git config are mounted read-only, and a GitHub token
# resolved on the host is forwarded by name only as `-e GH_TOKEN` (`-e
# GH_HOST`/`-e GH_ENTERPRISE_TOKEN` on a GitHub Enterprise host), never
# as a value in argv. `remote` is needed because resolving an issue
# goes through checkout-safe-branch, which runs `git fetch`: for an ssh
# origin the host's SSH agent socket and known_hosts are mounted
# (`SSH_AUTH_SOCK`/`GIT_SSH_COMMAND` forwarded); for an https origin
# the gh credential helper is configured so git authenticates with the
# forwarded GH_TOKEN. HOME stays in the allowlist for the native path.
# If docker is unavailable, engine_dispatch falls back to native on the
# host with a warning — see docs/agents/specs/docker/dispatch.md and
# docs/agents/specs/docker/environment.md.
#
# Usage: resolve_and_fetch.sh <repo_path> <issues_folder> <arg_string>
#
# Output (key=value lines) and exit code: unchanged from before this
# migration — see resolve_and_fetch_shell.sh's own header for the full
# STATUS=ok/STATUS=error contract.

set -euo pipefail

REPO_PATH="${1:-}"
[[ -n "$REPO_PATH" ]] || { echo "Usage: $0 <repo_path> <issues_folder> [arg_string]" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=engine_dispatch.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" resolve-and-fetch "${SCRIPT_DIR}/resolve_and_fetch_shell.sh" --needs=global-config,gitconfig,gh,remote HOME -- "$@"
