#!/usr/bin/env bash
# Thin subcommand-prepending wrapper around github_shell.sh, used only as
# the <shell_script> argument to engine_dispatch for the "pr-create"
# subcommand — see github.sh's header for why this exists (engine_dispatch
# passes the SAME trailing args to both the shell fallback and the native
# command, but only the shell fallback needs the subcommand prepended).
#
# Usage: github_shell_pr_create.sh <repo_path> <title> <file>
set -euo pipefail

exec bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/github_shell.sh" pr-create "$@"
