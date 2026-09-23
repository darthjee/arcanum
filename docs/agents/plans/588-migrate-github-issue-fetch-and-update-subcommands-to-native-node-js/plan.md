# Plan: Migrate github-issue fetch and update subcommands to native Node.js

Issue: [588-migrate-github-issue-fetch-and-update-subcommands-to-native-node-js.md](../../issues/588-migrate-github-issue-fetch-and-update-subcommands-to-native-node-js.md)

## Overview

Route `github_issue.sh fetch` and `update` through `engine_dispatch`, following the #237 `info`/`create` pattern. `scripter` adds the thin shell wrappers, the shim `case` branches with up-front argument-count checks, and the migration-status bookkeeping. `node` adds the native entrypoints (a CLI `fetch` method on `GithubIssue` that reuses the existing logic, plus a new `update` backed by `IssueClient#updateIssue`), registry entries, unit specs, and parity specs. Sub-issue A of #584. #589 (`mark-*`, umbrella-key removal) depends on this.

## Agents involved

- [node](node.md)
- [scripter](scripter.md)

## Shared contracts

### Command names and routing

| Subcommand | `migration-status.json` key / `core/bin/arcanum` command | Shell impl passed to `engine_dispatch` | Registry `validateRepoPath` |
|---|---|---|---|
| `fetch` | `github-issue-fetch` | `arcanum/_lib/github_issue_fetch_shell.sh` | default (validated) |
| `update` | `github-issue-update` | `arcanum/_lib/github_issue_update_shell.sh` | `false` |

Both use `context: 'repo'` in `core/lib/core/commands.js`. The shim calls `engine_dispatch "$REPO_PATH" github-issue-<cmd> "<shell impl>" HOME -- "$@"`, where `"$@"` is `<repo_path> <id>` for `fetch` and `<repo_path> <id> <title> <file>` for `update`. Native receives the same positionals: `Dispatcher.commandArgs()` strips the leading `repo_path`, so the method gets `(id)` / `(id, title, file)`.

### Argument-count checks live in the shim

`github_issue.sh`'s `fetch)` / `update)` branches reject missing positionals **before** `engine_dispatch`, printing to stderr and exiting 1:

- `Usage: $0 fetch <repo_path> <id>`
- `Usage: $0 update <repo_path> <id> <title> <file>`

The native side can therefore assume all positionals are present, and needs no usage-error handling of its own.

### Output / error contract (byte-identical to `github_issue_shell.sh`)

- `fetch` stdout: `TITLE=<title>\nFILE=docs/agents/issues/<id>-<slug>.md\nDOMAIN=<domain>\nREPO=<repo>\n`. It writes the issue file under `<repo_path>` and persists `.claude/state/issue-<id>.json` (`tags`, `updated_at`, `title`, `state`). Errors: `repo_path_enter`'s messages (via `RepoContext#validate()`) and `Error: could not fetch issue #<id> from <repo>`. All exit 1.
- `update` stdout: `Updated issue #<id> on <repo>\n`. Check order, mirroring `cmd_update`: (1) `<file>` exists, resolved against the **caller's cwd** and never against `repo_path` → `Error: file not found: <file>`; (2) origin resolution (`_load_origin` / `Origin#resolve` error); (3) PATCH `/repos/<repo>/issues/<id>` with `{title, body}`, where `body` is the file contents with **all** trailing newlines stripped → on failure `Error: could not update issue #<id> on <repo>`. All errors exit 1. There is no `repo_path_enter` / `RepoContext#validate()`.

### Landing order

Both halves ship in the same PR. `scripter`'s `migration-status.json` `true` keys are only valid once `node`'s registry entries exist, because `engine.mode=native` would otherwise invoke an unknown command.
