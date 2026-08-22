# Issue: Migrate github-issue entrypoint (info, create) to native Node.js

## Description

Part of the migration batch tracked in #232 (following #192, #193, #227). Migrates the `info` and `create` sub-commands of `arcanum/_lib/github_issue.sh` to native Node.js.

`core/lib/GithubIssue.js` already implements `fetch` (used internally as a direct JS import by `ResolveAndFetch.js` — not wired into `core/bin/arcanum`'s CLI router at all). This sub-issue **extends the existing class** with `info` and `create`. Out of scope: `fetch` (already native, JS-internal only), `update`, and the `mark-*` label commands — none of those are part of #232's original entrypoint list.

Unlike every entrypoint migrated so far (`resolve-and-fetch`, `checkout-safe-branch`, `resolve-id-and-file`, `list-agents`), `arcanum/_lib/github_issue.sh` has **no `engine_dispatch` shim at all yet** — every caller (`discuss-issue/scripts/github.sh`, `auto-new-issue/scripts/github.sh`, `arcanum-split-issue/scripts/github.sh`, `enhance-issue/scripts/github.sh`, plus `arcanum/_lib/resolve_and_fetch_shell.sh` and `spawn_issue.sh`) invokes it directly as 100% shell. This sub-issue introduces that shim for the first time, for a script with 10 sub-commands where only 2 are migrating now — see "Solution" below for how that's handled without breaking the other 8.

### Target script

`arcanum/_lib/github_issue.sh` — the two sub-commands in scope:

**`info <repo_path>`**
- Resolves the git origin (`origin.sh`'s `_load_origin`) and prints:
  ```
  DOMAIN=<domain>
  REPO=<owner/repo>
  ```
- Confirmed against current `github_issue.sh`: `cmd_info` does **not** call `repo_path_enter` — only `_load_origin` (which itself fails with `Error: '<repo_path>' is not a git repository or has no 'origin' remote` if `git -C <repo_path> remote get-url origin` fails). No separate directory/git-repo validation for `info`.

**`create <repo_path> <title> <file>`**
- `repo_path_enter <repo_path>`, validates `<file>` exists, resolves origin, gets a GitHub token, POSTs a new issue (title + body from `<file>`) to the GitHub REST API.
- On success, writes the created issue's body to `docs/agents/issues/` and prints (in this exact order):
  ```
  ID=<number>
  TITLE=<title>
  FILE=<filepath>
  DOMAIN=<domain>
  REPO=<owner/repo>
  ```
- On failure: error to stderr (`Error: could not create issue on <repo_ref>` for the API call, `Error: file not found: <file>` for a missing body file), exit 1.
- Confirmed: `cmd_create` does **not** call `issue_state.sh`/`IssueState` at all — state persistence is a `fetch`-only behavior. Native `create` must match this (no `IssueState.write` call) to stay byte-identical to the shell version.

## Solution

### Dependencies

- `core/lib/GithubIssue.js` (existing — extend, don't replace) — add `info(repoPath)` and `create(repoPath, title, file)` methods alongside the existing `fetch`.
- `core/lib/Origin.js` (existing — reuse for origin resolution).
- `core/lib/GithubToken.js` (existing — reuse for token resolution in `create`).
- `core/lib/RepoPath.js` (existing, landed via #233/PR #240 — reuse its `validate(repoPath)` for `create`'s repo-path check; matches `repo_path_enter`'s exact error messages/exit-1 behavior, and is already the established pattern via `ListAgents.js`/`SafeBranch.js`). `info` does **not** use it (see above).
- `core/lib/IssueState.js` is **not** a dependency here — `create` doesn't persist state (see confirmed parity note above).

### Migration status tracking (per-subcommand keys)

Because `github_issue.sh` bundles 10 sub-commands under one script and only 2 are migrating now, this sub-issue does **not** flip a single `github-issue` flag to `true` — that would route the still-shell-only `fetch`/`update`/`mark-*` calls through `core/bin/arcanum`, where they don't exist, breaking every other caller. Instead:

- Add two new keys to `arcanum/_lib/migration-status.json`: `github-issue-info` and `github-issue-create`, both flipped to `true`. Leave the existing bare `github-issue` key as-is (`false`) — it stops being a meaningful single unit once sub-commands migrate independently; a follow-up sub-issue can retire it once every sub-command has its own key, or repurpose it once all are `true`.
- Introduce the shim for the first time: split the current `arcanum/_lib/github_issue.sh` into `arcanum/_lib/github_issue_shell.sh` (the existing case-statement body, unchanged, becomes the shell implementation) and a new thin `arcanum/_lib/github_issue.sh` shim.
  - **Important asymmetry**: `engine_dispatch` passes the *same* trailing args to both its shell-fallback and native branches — it has no way to give each branch a different argv. But `github_issue_shell.sh`'s case statement needs the sub-command name as its own first arg (`github_issue_shell.sh info <repo_path>`), while the native side must **not** receive it (`core/bin/arcanum github-issue-info <repo_path>` — the sub-command is already encoded in the routing key). Passing the sub-command through the shared args (e.g. `-- "$subcommand" "$@"`) would leak it into the native call too, corrupting `GithubIssue#info`/`#create`'s first real argument.
  - Resolve this with two tiny fixed wrapper scripts that bake the sub-command in at the shell layer instead of passing it through args: `arcanum/_lib/github_issue_info_shell.sh` (`exec "$(dirname "${BASH_SOURCE[0]}")/github_issue_shell.sh" info "$@"`) and `arcanum/_lib/github_issue_create_shell.sh` (same, with `create`). The shim then dispatches per sub-command with **symmetric** args on both sides:
    ```bash
    case "$COMMAND" in
      info)   engine_dispatch "$REPO_PATH" github-issue-info   "${SCRIPT_DIR}/github_issue_info_shell.sh"   HOME -- "$@" ;;
      create) engine_dispatch "$REPO_PATH" github-issue-create "${SCRIPT_DIR}/github_issue_create_shell.sh" HOME -- "$@" ;;
      *)      exec "${SCRIPT_DIR}/github_issue_shell.sh" "$COMMAND" "$@" ;;  # fetch, update, mark-* — unchanged, no dispatch
    esac
    ```
    Here `"$@"` (after `$COMMAND` is shifted off) is just `<repo_path>` for `info` or `<repo_path> <title> <file>` for `create` — identical on both the shell-fallback and native paths. `fetch`/`update`/`mark-*` skip `engine_dispatch` entirely and call `github_issue_shell.sh` directly, unchanged from today (they have no migration-status.json key yet, so routing them through `engine_dispatch` would only add a pointless always-false lookup). Forward `HOME` in the allowlist, same reason `resolve_and_fetch.sh`'s shim does — `gh auth token` needs it once native's `env -i` strips the ambient environment.
- Add `github-issue-info` → `{ module: 'GithubIssue.js', method: 'info' }` and `github-issue-create` → `{ module: 'GithubIssue.js', method: 'create' }` to `core/bin/arcanum`'s `COMMANDS` registry. The native CLI args are just the sub-command's own arguments (`<repo_path>` for `info`; `<repo_path> <title> <file>` for `create`) — the sub-command name itself is encoded in the routing key, not passed as a positional arg.

### Migration contract

Following the pattern from #227/PR #228, adapted for the per-subcommand split above:
- `info` and `create` added to `core/lib/GithubIssue.js`, routed via `core/bin/arcanum github-issue-info <repo_path>` and `core/bin/arcanum github-issue-create <repo_path> <title> <file>`.
- Byte-identical output/exit-code to the shell counterparts (same `DOMAIN=`/`REPO=` lines for `info`; same `ID=`/`TITLE=`/`FILE=`/`DOMAIN=`/`REPO=` order and error text for `create`).
- Parity test at `core/spec/lib/GithubIssue_spec.js` (extend the existing spec) — runs shell vs native with identical inputs, asserts identical stdout + exit code, including the GitHub API mocked/stubbed the same way `fetch`'s existing tests do.
- Unit tests for error paths: missing repo_path, missing file for `create`, GitHub API failure (create), not-a-git-repo (info).
- Add `github-issue-info: true` and `github-issue-create: true` to `arcanum/_lib/migration-status.json` (leave bare `github-issue` untouched).
- Regenerate `docs/agents/architecture/entrypoint-migration-status.md` via `scripts/generate_entrypoint_migration_status.sh`.
- Zero runtime npm dependencies — only built-in Node APIs.

## References

- Parent: #232
- Migration design: docs/agents/architecture/script-engine.md
- Previous migrations: #192, #193, #227, #233
- Depended on by: the spawn-issue sub-issue (its native implementation must call `core/bin/arcanum github-issue-create ...` instead of the shell script)
