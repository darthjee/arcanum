# Plan: Migrate github-issue mark-* subcommands to native Node.js and finish the entrypoint migration

Issue: [589-migrate-github-issue-mark-subcommands-to-native-node-js-and-finish-the-entrypoint-migration.md](../../issues/589-migrate-github-issue-mark-subcommands-to-native-node-js-and-finish-the-entrypoint-migration.md)

## Overview

This routes the six `github_issue.sh mark-*` subcommands (`mark-created`, `mark-refined`, `mark-ready`, `mark-enhancing`, `mark-planning`, `mark-split`) through `engine_dispatch`. It follows the same pattern as #237 (`info`/`create`) and #588 (`fetch`/`update`), and then removes the last `exec` bypass from `github_issue.sh`.

- **scripter** owns the shell side: the per-command shell wrappers, the shim branches and the usage fallthrough, `migration-status.json`, and the regenerated status doc. It also repoints `scripts/generate_tags_table.sh` at the file that actually holds the `cmd_mark_*` bodies. Today it reads `github_issue.sh`, which lost them in #237, so every `mark-*` row in `docs/agents/tag-mutations.md` currently shows `-` / `-`.
- **node** owns the native side: a parity fix to `IssueTagger#mutateTag` (print the `Error:` line and add the shipit guard), a new table-driven `GithubIssueMark` command class, command registration, and unit and parity specs.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

### Command names (engine_dispatch name == `core/lib/core/commands.js` key == `migration-status.json` key)

| shim subcommand | dispatched command | shell impl |
|---|---|---|
| `mark-created` | `github-issue-mark-created` | `arcanum/_lib/github_issue_mark_created_shell.sh` |
| `mark-refined` | `github-issue-mark-refined` | `arcanum/_lib/github_issue_mark_refined_shell.sh` |
| `mark-ready` | `github-issue-mark-ready` | `arcanum/_lib/github_issue_mark_ready_shell.sh` |
| `mark-enhancing` | `github-issue-mark-enhancing` | `arcanum/_lib/github_issue_mark_enhancing_shell.sh` |
| `mark-planning` | `github-issue-mark-planning` | `arcanum/_lib/github_issue_mark_planning_shell.sh` |
| `mark-split` | `github-issue-mark-split` | `arcanum/_lib/github_issue_mark_split_shell.sh` |

The umbrella `"github-issue": false` key is **removed** from `migration-status.json`.

### Shell impl shape

Each shell impl is a 3-line `exec` wrapper, the same as `github_issue_fetch_shell.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/github_issue_shell.sh" mark-<name> "$@"
```

The issue text says to "copy each `cmd_mark_*` unchanged". We read that the way #588 did: the unchanged function stays the single source of truth inside `github_issue_shell.sh` and is reached through the wrapper. Copying the bodies into six files would duplicate them and leave `generate_tags_table.sh` with no single file to parse.

### Argv

`<repo_path> <id>` in both engines. The native side receives `(id)` after `Dispatcher.commandArgs()` strips `repoPath`. The shim checks `<id>` up front, so neither engine sees a missing id.

### Output / exit contract (both engines, byte-for-byte)

- `<repo>` is the **non-domain-qualified** `owner/repo`. That is `_ORIGIN_REPO_PATH` in the shell, and `(await context.resolve()).repo` natively. Do **not** use `resolveWithRef().repoRef`, because `cmd_mark_*` does not use `get_repo_ref`.
- Every tag is mutated in table order (the `add` first, then `removes[]`). Each one writes to stdout exactly one of:
  - `Added tag '<tag>' to issue #<id> on <repo>`
  - `Removed tag '<tag>' from issue #<id> on <repo>`
  - `Tag '<tag>' already present on issue #<id> — nothing to do.`
  - `Tag '<tag>' not present on issue #<id> — nothing to do.`
- When a mutation fails, stderr gets two lines. The first is `Error: could not fetch issue #<id> from <repo>` or `Error: could not update issue #<id> on <repo>`. The second is `Warning: could not add '<tag>' tag to issue #<id> on <repo>` or `Warning: could not remove '<tag>' tag from issue #<id> on <repo>`. Execution then continues with the next tag.
- Exit 0 after all mutations, even when some failed.
- If origin resolution fails, stderr gets `Error: '<repo_path>' is not a git repository or has no 'origin' remote` and the exit is 1 (`Origin#resolve`'s existing message; `validateRepoPath: false`, because `cmd_mark_*` never calls `repo_path_enter`).
- A missing `<id>` is handled in the shim: stderr `Usage: <shim> mark-<name> <repo_path> <id>`, exit 1.

### Transition table (native `MARK_TRANSITIONS`, mirrors `cmd_mark_*` exactly)

| subcommand | add | removes (in order) |
|---|---|---|
| created | created | idea, writting, enhancing |
| refined | refined | created, idea, writting |
| ready | ready | refined |
| enhancing | enhancing | idea, writting |
| planning | planning | idea, writting, created |
| split | split | planning |

## Ordering

The scripter and node work can run in parallel. The scripter's `migration-status.json` flip to `true` only takes effect once node's `commands.js` registration exists, and both land in the same PR.
