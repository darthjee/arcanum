#!/usr/bin/env bash
# Thin engine_dispatch shim for the "discuss-issue-render-issue" migrated
# entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/448-migrate-discuss-issue-render-issue-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Renders the issue template
# (../templates/issue.tmpl.md) into a file, via either the shell
# implementation (render_issue_shell.sh) or the native one
# (core/bin/arcanum), per engine.mode / arcanum/_lib/migration-status.json.
#
# No env vars are forwarded to the native path's allowlist — this
# entrypoint does no git/GitHub network I/O, only reading the static
# template and writing the output file (both already covered by
# repoPath/positional args, not env vars).
#
# Usage: render_issue.sh <output_file> <title> [description] [problem] [expected_behavior] [solution] [benefits]
#
# Unlike commit_change.sh/merge_main.sh, this entrypoint does not take
# <repo_path> as its own argument — every existing caller invokes it as
# `render_issue.sh "$REPO_PATH/$FILE" "<title>" ...` with an
# already-absolute <output_file>. engine_dispatch() still needs a
# repo_path for its config_chain_read call, so it is derived here from
# the ambient git checkout, the same convention confirm.sh uses.
#
# Output and exit code: unchanged from before this migration — see
# render_issue_shell.sh's own header for the full behavior contract.
# Note there is deliberately NO argument-presence check here: both
# render_issue_shell.sh (shell mode) and DiscussIssueRenderIssue.js
# (native mode) already guard the missing output_file/title case
# themselves — adding a validation block here would duplicate that
# contract instead of mirroring it.
#
# DiscussIssueRenderIssue.js is registered as `context: 'repo'`
# (core/lib/core/commands.js), so core/bin/arcanum's Dispatcher always
# consumes the native invocation's own leading positional as `repoPath`
# — but render_issue_shell.sh's CLI (<output_file> <title> ...) never
# takes one. `--prepend-repo-path` (arcanum/_lib/engine_dispatch.sh)
# is exactly this mismatched case: it prepends $REPO_PATH ahead of
# "$@" for the native invocation only, leaving render_issue_shell.sh's
# own args untouched.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"

REPO_PATH="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

engine_dispatch "$REPO_PATH" discuss-issue-render-issue "${SCRIPT_DIR}/render_issue_shell.sh" --prepend-repo-path -- "$@"
