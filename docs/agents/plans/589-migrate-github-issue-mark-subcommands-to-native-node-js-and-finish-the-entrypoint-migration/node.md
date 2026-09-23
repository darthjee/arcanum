# Node Plan: Migrate github-issue mark-* subcommands to native Node.js and finish the entrypoint migration

Main plan: [plan.md](plan.md)

## Shared contracts

- **Register** these six commands in `core/lib/core/commands.js`: `github-issue-mark-created`, `github-issue-mark-refined`, `github-issue-mark-ready`, `github-issue-mark-enhancing`, `github-issue-mark-planning` and `github-issue-mark-split`. The names must match the scripter's `engine_dispatch` names and `migration-status.json` keys.
- **Argv**: each method receives `(id)`, because `Dispatcher.commandArgs()` has already stripped `repoPath`. The shim guarantees `id` is non-empty.
- **Output/exit**: see plan.md's "Output / exit contract". `<repo>` is `(await context.resolve()).repo` (`owner/repo`, never domain-qualified). Mutations run in `MARK_TRANSITIONS` order. A per-tag failure prints the `Error:` line and then the `Warning:` line to stderr and moves on. The command exits 0 at the end, and exits 1 with `Origin#resolve`'s error when the origin can't be resolved.
- **Rely on** the scripter's shell wrappers `arcanum/_lib/github_issue_mark_<name>_shell.sh`, used by the engine-dispatch routing spec. Parity specs run `github_issue_shell.sh mark-<name>` directly, the same way the `githubIssue*Parity_spec.js` files do.

## Steps

- [01 — Fix IssueTagger#mutateTag parity (Error line + shipit guard)](node/01-fix-issue-tagger-mutate-tag-parity.md)
- [02 — Add the table-driven GithubIssueMark command](node/02-add-github-issue-mark-command.md)
- [03 — Register the six commands](node/03-register-commands.md)
- [04 — Add shell-vs-native parity and engine_dispatch routing specs](node/04-add-parity-specs.md)

## CI Checks

- `core/`: `cd core && npm test` (Jasmine) and `npx eslint .`. Whatever the `core/` CI job runs (see `.circleci/config.yml` / `.github/workflows/`), including coverage thresholds.

## Notes

- The shell has no up-front token check, unlike `IssueTagger#markEnqueued` which pre-checks with `getToken()` and throws `DispatchFailure('', 1)`. If `gh` auth is broken, each `gh issue view` fails and yields that tag's `Error:` + `Warning:` pair, and the command still exits 0. Do **not** add a token pre-check. A token failure inside `IssueClient` must surface through `mutateTag`'s catch as the fetch-failure pair.
- The fake labels (`FAKE_GH_ISSUE_LABELS` / `FAKE_FETCH_ISSUE_LABELS`) are static across calls on both sides, so after an `add` the next view still returns the original labels. That's fine for parity, because both sides see the same thing.
