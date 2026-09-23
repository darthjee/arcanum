# Issue: Migrate github-issue mark-* subcommands to native Node.js and finish the entrypoint migration

## Description

Sub-issue B of #584. Migrate the six `mark-*` subcommands of `arcanum/_lib/github_issue.sh` (`mark-created`, `mark-refined`, `mark-ready`, `mark-enhancing`, `mark-planning`, `mark-split`) to native Node.js, then finish the `github-issue` entrypoint migration. It depended on #588 (`fetch` + `update`), which is now merged (#590). With this issue done, every `github-issue` subcommand is dispatched.

## Problem

The `mark-*` subcommands reach `github_issue_shell.sh` through the `*)` `exec` fallthrough in `github_issue.sh`, so they never go through `engine_dispatch`. `migration-status.json` also still has the fake umbrella key `"github-issue": false`. That key is not a dispatched command name, so the generated status doc lists a pending command that does not exist.

## Expected Behavior

All six subcommands route through `engine_dispatch`. In both `engine.mode=native` and `engine.mode=shell`, stdout, stderr and exit codes must match the shell `cmd_mark_*` functions **exactly**, because the AI skills read this output.

Adds and removes, taken from the shell source (the order matters for output):

| subcommand | adds | removes (in order) |
|---|---|---|
| `mark-created` | created | idea, writting, enhancing |
| `mark-refined` | refined | created, idea, writting |
| `mark-ready` | ready | refined |
| `mark-enhancing` | enhancing | idea, writting |
| `mark-planning` | planning | idea, writting, created |
| `mark-split` | split | planning |

For each tag mutation, the output matches `tag_mutate.sh`:

- stdout: `Added tag '<tag>' to issue #<id> on <repo>`, `Removed tag '<tag>' from issue #<id> on <repo>`, `Tag '<tag>' already present on issue #<id> — nothing to do.`, or `Tag '<tag>' not present on issue #<id> — nothing to do.`
- stderr on failure: first `Error: could not fetch issue #<id> from <repo>` or `Error: could not update issue #<id> on <repo>`, then the caller's `Warning: could not add/remove '<tag>' tag to/from issue #<id> on <repo>`.
- A failed mutation is only a warning. The subcommand continues with the next tag and exits 0.

Exits other than 0, which the native side must reproduce:

- A missing `<repo_path>` or `<id>` gives a usage error and exit 1.
- If `<repo_path>` is not a git repo or has no `origin`, `_load_origin` prints `Error: '<repo_path>' is not a git repository or has no 'origin' remote` and exits 1.

The shipit guard stays. No `mark-*` table entry touches `shipit`.

## Solution

Follow `docs/agents/architecture/script-engine.md` and the #237 / #588 plans:

1. **Shell impls**: copy each `cmd_mark_*` unchanged into its own `arcanum/_lib/github_issue_mark_<name>_shell.sh`. Leave `github_issue_shell.sh` as it is; removing it is a separate, later cleanup.
2. **Shim**: in `github_issue.sh`, add one `case` branch per subcommand. Following the `fetch` / `update` pattern from #588, each branch first checks `<id>` (`${2:-}`) and on a miss prints `Usage: $0 mark-<name> <repo_path> <id>` to stderr and exits 1, so neither engine has to handle usage errors. It then calls `engine_dispatch "$REPO_PATH" github-issue-mark-<name> "<shell impl>" HOME -- "$@"`.
3. **Native**: write one shared implementation driven by a `{ add, removes[] }` table keyed by subcommand, not one parameterized by a single tag. Reuse `IssueTagger#mutateTag` and `Tags.js`'s `TAG_TO_LABEL`; do not re-derive label mapping or mutation logic. Resolve `repoRef` through `RepoContext` the same way `IssueTagger#markEnqueued` does, and map a resolution failure to the `_load_origin` error and exit 1.
4. **Known parity gap in `IssueTagger#mutateTag`**: its doc comment says it mirrors `tag_mutate.sh`, but on a fetch or update failure it prints only the `Warning: ...` line. It drops the `Error: could not fetch/update issue ...` line that `tag_mutate.sh` prints first. **Fix it in place**: make `mutateTag` print the matching `Error:` line to stderr before the `Warning:` line. This also closes the same gap for its existing callers, the native `markEnqueued` used by `auto-fix-all` and `auto-fix-issue`. Update `IssueTaggerMutateTag_spec.js`, `IssueTaggerMarkEnqueued_spec.js` and any affected parity specs to match.
5. **Registration**: add the six `github-issue-mark-*` commands to the native command table in `core/lib/core/commands.js` (next to `github-issue-fetch` / `github-issue-update`), and add six `true` keys to `arcanum/_lib/migration-status.json`.
6. **Finish the entrypoint migration**:
   - Remove the umbrella `"github-issue": false` key from `migration-status.json`.
   - Replace the `*)` `exec` fallthrough in `github_issue.sh` with a usage error based on `github_issue_shell.sh`'s usage block. **Fix the `mark-refined` line** so it says it removes Created/Idea/Writting, not just Created, and remove the stray extra space on the `mark-planning` / `mark-split` lines.
   - Update the header comment of `github_issue.sh`, which still says `mark-*` bypass `engine_dispatch` until #589.
   - Regenerate `docs/agents/architecture/entrypoint-migration-status.md` with `scripts/generate_entrypoint_migration_status.sh`.
7. **Specs**: add native unit specs that mirror `core/lib/` one-to-one. Under `core/spec/bin/`, add a shell-vs-native parity spec per `mark-*` command, following `githubIssue*Parity_spec.js`. Cover the added, removed, nothing-to-do, failure-warning, usage-error and missing-origin cases. Verify `engine_dispatch.sh` routing in both modes.

## Benefits

- Completes the `github-issue` migration: no `exec` bypass of `engine_dispatch` remains, and the migration-status doc lists only real commands.
- The pipeline's most frequent label transitions go through the same native `IssueTagger` path that `auto-fix-all` already uses.
