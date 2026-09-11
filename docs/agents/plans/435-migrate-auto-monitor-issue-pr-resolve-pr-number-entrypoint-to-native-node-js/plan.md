# Plan: Migrate auto-monitor-issue-pr-resolve-pr-number entrypoint to native Node.js

Issue: [435-migrate-auto-monitor-issue-pr-resolve-pr-number-entrypoint-to-native-node-js.md](../issues/435-migrate-auto-monitor-issue-pr-resolve-pr-number-entrypoint-to-native-node-js.md)

## Overview

Migrate `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` — which resolves the PR number for an issue's branch, checking cached issue state first and falling back to a `gh pr view` lookup — to a native `core/lib/` module, following the exact split established by every other entrypoint in the #427 batch (e.g. #428, #430, #434): scripter renames the existing script to a `_shell.sh` counterpart and replaces it with a thin `engine_dispatch` shim; node adds the byte-identical native implementation with full unit and parity test coverage.

The native implementation does not need to shell out to `gh` at all: `core/lib/utils/github/GitHubClient.js`'s `getPr(branch)` (already used by `AutoFixIssueGithub.js` for the same kind of branch → PR lookup) replaces `gh pr view -R <repo_ref> <branch> --json number` via the GitHub REST API, `core/lib/utils/git/Git.js#currentBranch()` replaces `git branch --show-current`, and `core/lib/services/IssueStateService.js#get(id, field)` replaces the `issue-state get <id> pr_id` cache lookup.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

- **Command name**: `auto-monitor-issue-pr-resolve-pr-number` — used verbatim as (a) the `arcanum/_lib/migration-status.json` key, (b) the `<command>` argument scripter's shim passes to `engine_dispatch`, (c) the `COMMANDS` map key node adds to `core/lib/core/commands.js`, and (d) the subcommand node's parity test invokes via `core/bin/arcanum auto-monitor-issue-pr-resolve-pr-number`. All four must match exactly, character for character.
- **Shell implementation path**: scripter renames the current script to `auto-monitor-issue-pr/scripts/resolve_pr_number_shell.sh` (content unchanged). Node's parity test must invoke this exact path directly — never through the new `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` shim, which would make the parity test circular.
- **Env allowlist**: scripter's shim forwards `HOME` (`engine_dispatch "$REPO_PATH" auto-monitor-issue-pr-resolve-pr-number "${SCRIPT_DIR}/resolve_pr_number_shell.sh" HOME -- "$@"`), matching every other shim wrapping a `gh`-calling entrypoint (`auto-fix-issue/scripts/github.sh`, `run_checks.sh`) — needed for `gh`/token resolution to work once native's `env -i PATH="$PATH"` strips the ambient environment down. Node can rely on `HOME` being present in `process.env` when invoked natively through the shim.
- **Argument shape unchanged**: both sides take `<repo_path> <id>` (`id`'s `#` prefix tolerated/stripped by both).
