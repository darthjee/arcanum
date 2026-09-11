# Plan: Migrate auto-fix-issue-github entrypoint to native Node.js

Issue: [430-migrate-auto-fix-issue-github-entrypoint-to-native-node-js.md](../issues/430-migrate-auto-fix-issue-github-entrypoint-to-native-node-js.md)

## Overview

Migrate `auto-fix-issue/scripts/github.sh` (4 subcommands: `info`, `pr-create`, `pr-view`, `pr-ready`) to native `core/lib/` code, following `AutoFixAllGithub.js`/`GithubIssue.js`'s registration pattern (one `COMMANDS` entry per subcommand, not a single internal-dispatch entry) and `commit_change.sh`/`create_branch.sh`'s (#428/#429) precedent of actually rewriting the shell entrypoint into real per-subcommand `engine_dispatch` shims, so `engine.mode` genuinely controls routing.

## Agents involved

- [node](node.md)
- [scripter](scripter.md)

## Shared contracts

- **Command names**: four separate strings, used verbatim as (a) `arcanum/_lib/migration-status.json` keys, (b) the `<command>` argument scripter's router passes to `engine_dispatch` per subcommand, and (c) the `COMMANDS` map keys node adds to `core/lib/core/commands.js`:
  - `auto-fix-issue-github-info`
  - `auto-fix-issue-github-pr-create`
  - `auto-fix-issue-github-pr-view`
  - `auto-fix-issue-github-pr-ready`

  All three sides must match exactly, character for character. Each subcommand's `engine_dispatch` native-availability check (`arcanum/_lib/engine_dispatch.sh`'s `_engine_dispatch_native_available`) looks up the exact `<command>` string passed to it — a single shared key (the `auto-fix-all-github` precedent's shape) would not gate per-subcommand routing correctly here, since this migration (unlike that one) wires real per-subcommand dispatch.

- **Shell implementation path**: scripter renames the current script to `auto-fix-issue/scripts/github_shell.sh` (content unchanged — same internal `case "$1" in info|pr-create|pr-view|pr-ready)` dispatch and shared helpers `_current_issue_id`/`_persist_pr_state`/`_sync_pr_labels_and_state` it has today). The new `auto-fix-issue/scripts/github.sh` becomes a thin per-subcommand router: it reads `$1` (the subcommand) itself, maps it to the matching command name above, and calls `engine_dispatch` with `github_shell.sh` as the shell fallback, **passing the full original argument list through unchanged** (including the leading subcommand) — `github_shell.sh`'s own case-statement still expects it. This keeps the shared shell helpers in one file rather than duplicating them across four renamed scripts. Node's parity tests must invoke `github_shell.sh` directly, never through the new `github.sh` router, to avoid a circular test.

- **Env allowlist**: scripter's router forwards `HOME` in `engine_dispatch`'s env allowlist only for `pr-create`, `pr-view`, and `pr-ready` — all three call `gh` (via `_ensure_gh_user`/token resolution), and `gh` needs `HOME` to find its own auth config once native's `env -i PATH="$PATH"` strips the ambient environment down. `info` forwards no env vars (it only parses `git remote get-url origin`, no `gh` call) — mirroring `create_branch.sh`'s no-env-var precedent for a git-only entrypoint. Node's native module can rely on `HOME` being present in `process.env` for `prCreate`/`prView`/`prReady` (needed by `GithubToken#get`'s `gh auth token`/`gh auth switch` calls), but must not assume it for `info`.

- **Output/exit-code contract per subcommand** (byte-identical parity is required for all four):
  - `info`: stdout `DOMAIN=<domain>\nREPO=<repo>\n`, exit 0.
  - `pr-create <title> <file>`: stdout `<pr_url>\n`, exit 0 on success; `Error: file not found: <file>` to stderr + exit 1 when `file` doesn't exist; `Error: could not create PR on <repo_ref>` to stderr + exit 1 on API failure.
  - `pr-view`: stdout `URL=<url>\nIS_DRAFT=<true|false>\n`, exit 0 on success; **silent exit 1, no stderr output at all**, specifically when no PR is found for the current branch (mirrors the shell's `gh pr view` "no pull requests found" case) — use `core/lib/utils/errors/DispatchFailure.js`'s `DispatchFailure('', 1)` for this, the same pattern `AutoFixAllGithub#hasShipitLabel` already uses; any *other* lookup failure still prints `Error: could not view PR on <repo_ref>: <detail>` to stderr + exit 1.
  - `pr-ready`: stdout `OK\n`, exit 0 on success; `Error: could not mark PR ready on <repo_ref>` to stderr + exit 1 on API failure.
  - `pr-create`/`pr-ready` both also run the best-effort `pr` label + `tags` refresh + conditional `auto-shipit` label sync (see node's plan) — failures there are warnings on stderr only, never a non-zero exit.
