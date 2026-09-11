# node Plan: Migrate auto-fix-issue-github entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Registers four `COMMANDS` entries in `core/lib/core/commands.js` — `auto-fix-issue-github-info`, `auto-fix-issue-github-pr-create`, `auto-fix-issue-github-pr-view`, `auto-fix-issue-github-pr-ready` — each string must match the corresponding `migration-status.json` key and the `<command>` argument scripter's router passes to `engine_dispatch`.
- Writes parity tests against `auto-fix-issue/scripts/github_shell.sh` — the exact path scripter's rename produces — invoked directly, never through the new `github.sh` router.
- Can rely on `HOME` being present in `process.env` when invoked natively for `prCreate`/`prView`/`prReady` (needed by `gh auth token`/`gh auth switch`), but not for `info`.
- `pr-view`'s "no PR found" case must use `DispatchFailure('', 1)` (empty stdout, exit 1, nothing on stderr) — see `core/lib/commands/auto-fix-all/AutoFixAllGithub.js#hasShipitLabel` for the existing precedent of this exact pattern.

## Steps

- [01 — Extend GitHubClient with PR create and ready-for-review support](node/01-extend-githubclient.md)
- [02 — Implement AutoFixIssueGithub.js and register it](node/02-implement-autofixissuegithub.md)
- [03 — Unit tests](node/03-unit-tests.md)
- [04 — Parity tests](node/04-parity-tests.md)

## CI Checks

- `core/`: `yarn test` (CI job: `test`, `.circleci/config.yml`) — local equivalent: `make core-test`.
- `core/`: `yarn lint` (CI job: `checks`, `.circleci/config.yml`) — local equivalent: `make core-lint`.

## Notes

- Reuse existing native equivalents rather than re-deriving them: `core/lib/utils/issue/Tags.js` (`extractTags`), `core/lib/utils/issue/IssueTagger.js#mutateTag` (best-effort tag/label mutation — **not** `core/lib/services/TagMutationService.js#addTag`, which throws on failure instead of warning-and-continuing; the shell's `_sync_pr_labels_and_state` is explicitly best-effort, so `IssueTagger#mutateTag` is the correct match), `core/lib/utils/git/Origin.js` (via `RepoContext#resolveWithRef`), `core/lib/utils/github/GithubToken.js` (already folds in `_ensure_gh_user` via its `get()`), and `core/lib/services/IssueStateService.js` (`set`/`setJson`, in-process — not by shelling out to `core/bin/arcanum issue-state`).
- `GH_INSECURE_SKIP_VERIFY=true` is exported at the top of the current `github.sh` — confirm during Step 1 whether this needs any native counterpart (e.g. a `fetch` TLS option) or is shell/`gh`-CLI-specific and has no native equivalent to carry over.
