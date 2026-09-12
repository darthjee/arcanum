# Plan: Migrate auto-new-issue-commit-issue entrypoint to native Node.js

Issue: [450-migrate-auto-new-issue-commit-issue-entrypoint-to-native-node-js.md](../issues/450-migrate-auto-new-issue-commit-issue-entrypoint-to-native-node-js.md)

## Overview

Migrate `auto-new-issue/scripts/commit_issue.sh` (stages an issue file, builds a
commit message via the commit-template/agent-email helpers with the agent fixed
to `"architect"`, commits, then pushes) to a native `core/bin/arcanum` entrypoint,
per `docs/agents/architecture/script-engine.md`. The `node` agent builds the
native module, registers it, and writes its unit + parity tests; the `scripter`
agent extracts the existing shell logic into a `_shell.sh` sibling and replaces
`commit_issue.sh` with a thin `engine_dispatch.sh` shim, verifying both
`engine.mode=native` and `engine.mode=shell` routing.

## Agents involved

- [node](node.md)
- [scripter](scripter.md)

## Shared contracts

- **Command key**: `auto-new-issue-commit-issue` — the `migration-status.json`
  key and the `core/bin/arcanum` routing key `node` registers in
  `core/lib/core/commands.js` and `scripter` dispatches to.
- **CLI contract** (byte-identical stdout/exit code between shell and native):
  `commit_issue.sh <repo_path> <file_path> <id> <model_name> <model_email>`.
  - Missing/empty argument → usage message on stderr, exit 1:
    `Usage: commit_issue.sh <repo_path> <file_path> <id> <model_name> <model_email>`.
  - `<file_path>` not found → `Error: file not found: <file_path>` on stderr, exit 1.
  - On success: `git commit`'s own stdout (its `[branch hash] subject` summary),
    immediately followed by `git push -u`'s own stdout — concatenated verbatim,
    in that order, exit 0.
- **`commit_issue_shell.sh`'s own CLI takes `<repo_path>` as its own first
  argument** (like `commit_change_shell.sh`, unlike `commit_plan_shell.sh`'s
  `--prepend-repo-path`-free case which is the same shape) — the shim passes
  `"$@"` straight through with no `--prepend-repo-path` flag needed, since
  `<repo_path>` is already the shell script's own first positional.
- **Native module**: `core/lib/commands/auto-new-issue/AutoNewIssueCommitIssue.js`,
  exported method `run`, registered with `context: 'repo'`.
- **Sequencing note**: the parity test (`node`'s step 4) exercises the shim
  script in both engine modes, so it can only be verified end-to-end once
  `scripter`'s shim/shell-split (see [scripter.md](scripter.md)) exists —
  `node` can write the module, unit tests, and registration independently,
  but hold the parity spec's actual run until the shim lands.
