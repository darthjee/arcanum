# Node Plan: Migrate github-issue fetch and update subcommands to native Node.js

Main plan: [plan.md](plan.md)

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

## Steps

- [01 — Add IssueClient#updateIssue](node/01-issue-client-update-issue.md)
- [02 — Add the fetch and update CLI methods to GithubIssue](node/02-github-issue-cli-methods.md)
- [03 — Register the commands](node/03-register-commands.md)
- [04 — Parity specs](node/04-parity-specs.md)

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)
- `core`: `yarn duplication` (CI job: `checks`, non-blocking). Keep new specs from cloning the create/info parity specs; extract shared helpers under `core/spec/support/` if needed.

## Notes

- **Do not change `GithubIssue#fetch(repoPath, id)`'s signature or return shape.** `ResolveAndFetch` constructs `new GithubIssue(repoContext)` and calls `fetch(repoPath, id)`, so a `create`-style "shift args when `_repoContext` is set" rewrite of `fetch` would break it. The CLI entry therefore needs its own method name.
- No real network calls in specs (repo convention). Cover success paths with a mocked `fetchFn`.
