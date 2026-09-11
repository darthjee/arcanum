# Plan: Migrate auto-fix-issue-commit-change entrypoint to native Node.js

Issue: [428-migrate-auto-fix-issue-commit-change-entrypoint-to-native-node-js.md](../issues/428-migrate-auto-fix-issue-commit-change-entrypoint-to-native-node-js.md)

## Overview

Migrate `auto-fix-issue/scripts/commit_change.sh` — which commits changes a specialist agent has already staged, then pushes the branch — to a native `core/lib/` module, following the exact pattern established by the `auto-fix-all-cleanup-artifacts` migration (#254, PR #267): rename the existing script to a `_shell.sh` counterpart, replace it with a thin `engine_dispatch` shim, and add a byte-identical native implementation with full unit and parity test coverage.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

- **Command name**: `auto-fix-issue-commit-change` — used verbatim as (a) the `arcanum/_lib/migration-status.json` key, (b) the `<command>` argument scripter's shim passes to `engine_dispatch`, (c) the `COMMANDS` map key node adds to `core/lib/core/commands.js`, and (d) the subcommand node's parity test invokes via `core/bin/arcanum auto-fix-issue-commit-change`. All four must match exactly, character for character.
- **Shell implementation path**: scripter renames the current script to `auto-fix-issue/scripts/commit_change_shell.sh` (content unchanged). Node's parity test must invoke this exact path directly — never through the new `auto-fix-issue/scripts/commit_change.sh` shim, which would make the parity test circular.
- **Env allowlist**: scripter's shim forwards `HOME` to the native invocation (`engine_dispatch "$REPO_PATH" auto-fix-issue-commit-change "${SCRIPT_DIR}/commit_change_shell.sh" HOME -- "$@"`), matching every other existing shim wrapping a `git commit`/`git push` entrypoint (`cleanup_artifacts.sh`, `reply_comment.sh`, `wait_ci_and_merge.sh`, `wait_ci.sh`, `create_sub_issue.sh`, `push_sub_issues.sh`, `finish.sh`). Node's module can rely on `HOME` being present in `process.env` for `git` to resolve config/identity when invoked natively through the shim; no other env var needs to cross this boundary.
