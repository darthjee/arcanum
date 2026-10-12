#!/usr/bin/env bash
# Thin engine_dispatch shim for the "arcanum-create-issue-start" entrypoint —
# see docs/agents/architecture/arcanum-create-issue.md ("Native commands")
# and docs/agents/architecture/script-engine.md for the full design/shared
# contracts. Starts a new issue draft or resumes an existing one under
# .claude/state/create-issue/.
#
# Native-only: this command has NO shell implementation (no *_shell.sh
# twin). It is listed in arcanum/_lib/migration-status.json with a
# non-`shell` status, but never falls back to a shell twin. It is
# dispatched with `engine_dispatch --native-only`, which always runs
# core/bin/arcanum.
#
# Under engine.mode=docker it runs core/bin/arcanum inside the
# container, now that its migration-status.json status is `"docker"`
# (#749), with the repo mount plus `--needs=global-config,gitconfig,gh`:
# the global arcanum config ($CLAUDE_CONFIG_DIR/arcanum-config.json) and
# the global git config are mounted read-only, and a GitHub token
# resolved on the host is forwarded by name only as `-e GH_TOKEN`
# (`-e GH_HOST`/`-e GH_ENTERPRISE_TOKEN` on a GitHub Enterprise host),
# never as a value in argv. The container has no TTY, so a call that
# would prompt takes the exit-4 `FALLBACK=chat` path instead —
# for `start`, when drafts exist and neither `--new` nor `--resume` is
# given (the `DRAFT=` lines are printed as usual).
# Calls that pass those flags never touch the TTY and behave as they do
# natively. There is no `--path-arg`: drafts live under
# <repo>/.claude/state/create-issue/, inside the repo mount, which keeps
# the same absolute path in the container. HOME stays in the allowlist
# for the native path. If docker is unavailable, engine_dispatch falls
# back to native on the host with a warning — see
# docs/agents/specs/docker/dispatch.md and
# docs/agents/specs/docker/environment.md.
#
# `HOME` is forwarded to the native path's explicit env-var allowlist (as
# every other native GitHub-calling shim does) so gh/token resolution
# keeps working under native's `env -i`.
#
# <repo_path> is forwarded as the first native argument, where the
# `context: 'repo'` dispatcher consumes it, so --prepend-repo-path is not
# used. Every remaining argument is forwarded verbatim; the native command
# validates them.
#
# Usage: start.sh <repo_path> [--new | --resume <draft>]
#
# Output and exit code: passed through unchanged from core/bin/arcanum
# arcanum-create-issue-start (KEY=value lines on stdout; exit 0 for
# STATUS=new/resumed, 1 for STATUS=error, 2 for invalid input, 4 for
# FALLBACK=chat). A missing
# <repo_path> is rejected here with exit 2.

set -euo pipefail

REPO_PATH="${1:-}"

[[ -n "$REPO_PATH" ]] || {
  echo "Usage: $0 <repo_path> [--new | --resume <draft>]" >&2
  exit 2
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" arcanum-create-issue-start "" --native-only --needs=global-config,gitconfig,gh HOME -- "$@"
