# Scripter Plan: Migrate github-issue fetch and update subcommands to native Node.js

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

## Implementation Steps

### Step 1 — Shell wrappers and shim branches

- Add `arcanum/_lib/github_issue_fetch_shell.sh` and `arcanum/_lib/github_issue_update_shell.sh` as exact analogues of `github_issue_create_shell.sh`: `set -euo pipefail`, then `exec "<dir>/github_issue_shell.sh" fetch|update "$@"`. Do **not** copy `cmd_fetch`/`cmd_update`, and leave `github_issue_shell.sh` untouched. Make them executable, matching the existing wrappers.
- In `arcanum/_lib/github_issue.sh`, add `fetch)` and `update)` branches ahead of `*)`. Each first checks the remaining positionals (`${2:-}` for `fetch`; `${2:-}`, `${3:-}`, `${4:-}` for `update`, since `$1` is `REPO_PATH` after the earlier `shift`). On failure it prints the contract's usage line to stderr and exits 1. Then it calls `engine_dispatch "$REPO_PATH" github-issue-<cmd> "${SCRIPT_DIR}/github_issue_<cmd>_shell.sh" HOME -- "$@"`.
- Keep the `*)` `exec` fallthrough, because `mark-*` still uses it until #589.
- Rewrite the header comment: `info`/`create`/`fetch`/`update` route through `engine_dispatch` (reference #237 and #588), and only `mark-*` still call the shell implementation directly until #589.

### Step 2 — Migration-status bookkeeping

- Add `"github-issue-fetch": true` and `"github-issue-update": true` to `arcanum/_lib/migration-status.json`, next to the existing `github-issue-create`/`github-issue-info` keys. Leave `"github-issue": false` alone; #589 removes it.
- Regenerate `docs/agents/architecture/entrypoint-migration-status.md` via `scripts/generate_entrypoint_migration_status.sh`, and commit the regenerated output. Do not hand-edit it.

## Files to Change

- `arcanum/_lib/github_issue_fetch_shell.sh` — new thin wrapper.
- `arcanum/_lib/github_issue_update_shell.sh` — new thin wrapper.
- `arcanum/_lib/github_issue.sh` — `fetch)`/`update)` branches with argument-count checks, updated header comment.
- `arcanum/_lib/migration-status.json` — two new `true` keys.
- `docs/agents/architecture/entrypoint-migration-status.md` — regenerated.

## CI Checks

- `core`: `yarn test` (CI job: `test`). The parity specs under `core/spec/bin/` shell out to these scripts.
- `core`: `yarn lint` (CI job: `checks`).

## Notes

- Manually verify routing both ways: with `engine.mode=shell` (default) and `engine.mode=native` in the target repo's config, `github_issue.sh fetch <repo> <id>` and `update ...` produce identical output. Missing-argument calls print the shim's usage line in both modes.
- Run `shellcheck` on the touched/new scripts if it is available locally.
