# Plan: Migrate github-issue entrypoint (info, create) to native Node.js

Issue: [237-migrate-github-issue-entrypoint-info-create-to-native-node-js.md](../../issues/237-migrate-github-issue-entrypoint-info-create-to-native-node-js.md)

## Overview

Extend the existing `core/lib/GithubIssue.js` with native `info` and `create` methods, wire them into `core/bin/arcanum`'s command router, and — for the first time for this particular shell script — introduce the `engine_dispatch` shim for `arcanum/_lib/github_issue.sh`, split per sub-command so the 8 still-shell-only sub-commands (`fetch`, `update`, `mark-*`) keep working unchanged while `info`/`create` gain native routing.

## Agents involved

- [node](node.md)
- [scripter](scripter.md)

## Shared contracts

- **Routing keys**: `github-issue-info` and `github-issue-create` — used identically as (a) `arcanum/_lib/migration-status.json` keys (scripter), (b) `core/bin/arcanum`'s `COMMANDS` registry keys (node), and (c) the first argument scripter's new shim passes to `engine_dispatch`. All three must match byte-for-byte or dispatch silently falls back to shell.
- **CLI argument shape**: the native commands take only the sub-command's own positional arguments — `core/bin/arcanum github-issue-info <repo_path>` and `core/bin/arcanum github-issue-create <repo_path> <title> <file>`. The sub-command name itself is encoded in the routing key, not passed as a positional arg. This matters because `engine_dispatch` passes the **same** trailing args to both its shell-fallback and native branches — it can't give each branch a different argv. Scripter's shim resolves this with two tiny fixed wrapper scripts (`github_issue_info_shell.sh`, `github_issue_create_shell.sh`) that bake the sub-command name in at the shell layer instead of passing it through args, so `engine_dispatch`'s own trailing args stay just `<repo_path> [title file]` — identical on both sides. See scripter/01 for the exact scripts.
- **stdout contract**: `GithubIssue#info` and `GithubIssue#create` must each return a plain **string** (not an object, unlike `fetch`) — `core/bin/arcanum`'s router only writes `output` to stdout when `typeof output === 'string'`. `info` returns `` `DOMAIN=${domain}\nREPO=${repo}\n` ``; `create` returns `` `ID=${id}\nTITLE=${title}\nFILE=${filePath}\nDOMAIN=${domain}\nREPO=${repo}\n` `` — exact key order matters (mirrors `cmd_create`'s `echo` order).
- **Env allowlist**: scripter's shim forwards `HOME` to the native invocation (same reason `resolve_and_fetch.sh`'s shim does) — `create`'s `GithubToken#get` shells out to `gh auth token`, which needs `HOME` once native's `env -i PATH="$PATH"` strips the ambient environment. `info` doesn't need a token but the same shim line covers both sub-commands, so `HOME` is forwarded regardless.
- **No `IssueState` in `create`**: confirmed against the shell (`cmd_create` never calls `issue_state.sh`) — native `create` must not call `IssueState#write` either. Only `fetch` persists state.

## Notes

- `fetch` stays exactly as-is: a direct JS import used internally by `ResolveAndFetch.js`, not wired into `COMMANDS` or `migration-status.json`. This plan doesn't touch it.
- `update` and the `mark-*` sub-commands stay 100% shell for now (out of scope, no migration-status.json keys added for them) — scripter's new shim's per-subcommand `engine_dispatch` call handles this automatically via the "missing key defaults to false" behavior already built into `_engine_dispatch_native_available`.
