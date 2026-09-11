# Issue: Migrate auto-fix-issue-github entrypoint to native Node.js

## Description

Part of the ongoing shell → Node.js entrypoint migration (see `docs/agents/architecture/script-engine.md`), tracked as batch overview #427. This issue migrates `auto-fix-issue/scripts/github.sh` to native `core/lib/` modules.

`github.sh` is `auto-fix-issue`'s GitHub-facing entrypoint (203 lines, dispatching four subcommands from a leading command argument): `info`, `pr-create`, `pr-view`, `pr-ready`. It also sources `arcanum/_lib/repo_path.sh` (`repo_path_enter`) for a not-a-git-repo guard shared across all four subcommands, in addition to `arcanum/_lib/origin.sh`'s own origin-resolution error path.

Usage: `github.sh <command> <repo_path> [args]`:
- `info <repo_path>` — print `DOMAIN`/`REPO` from the git origin.
- `pr-create <repo_path> <title> <file>` — create a PR with title and body-from-file; persists `pr_url`/`pr_id` into issue state (via `issue_state.sh`) when the current branch matches `issue-<id>`; also calls `_ensure_gh_user`; then syncs PR labels/state (adds the `pr` label to the issue, refreshes the issue's `tags` in `.claude/state/issue-<id>.json` from live GitHub labels, and adds the PR-only `auto-shipit` label if `shipit` is among those tags).
- `pr-view <repo_path>` — print `URL`/`IS_DRAFT` for the current branch's PR; persists `pr_url`/`pr_id` as a side effect; exits 1 with no stderr output specifically when `gh pr view` reports "no pull requests found".
- `pr-ready <repo_path>` — mark the current branch's PR ready for review, then run the same label/state sync as `pr-create`.

`_current_issue_id` derives the issue id purely from the current branch name matching `issue-<id>` — no id is passed explicitly to most subcommands.

## Expected Behavior

- Each native `arcanum` command (`auto-fix-issue-github-info`, `auto-fix-issue-github-pr-create`, `auto-fix-issue-github-pr-view`, `auto-fix-issue-github-pr-ready`) produces byte-identical stdout and the same exit code as the corresponding `github.sh` subcommand, for the same inputs and repo state — including `pr-view`'s silent exit-1 ("no pull requests found") case.
- With `engine.mode=native` in the target repo's config, `auto-fix-issue/scripts/github.sh` dispatches each subcommand to its native command for real; with `engine.mode=shell` or missing, it falls back to the existing shell behavior for that subcommand — verified via `arcanum/_lib/engine_dispatch.sh` against the actual rewritten script, not a throwaway stand-in wrapper.
- No regression to label/state sync side effects (`pr` label, `tags` refresh, `auto-shipit` label) or to `_ensure_gh_user`'s account-switch behavior.

## Solution

Follow the standard migration process from `docs/agents/architecture/script-engine.md`. Two precedent choices were resolved explicitly for this issue (the earlier auto-drafted version conflated them): use `GithubIssue.js`/`AutoFixAllGithub.js` as the structural precedent — one `COMMANDS` entry per subcommand, each with its own method, not a single internal-dispatch entry like `IssueState.js` — and use `auto-fix-issue/scripts/commit_change.sh` (#428) / `create_branch.sh` (#429) as the precedent for actually rewriting the shell entrypoint into real per-subcommand `engine_dispatch` shims, rather than deferring that wiring the way `auto-fix-all-github` did.

1. Read `auto-fix-issue/scripts/github.sh` for its exact per-subcommand output/exit-code contract, including the `repo_path_enter` guard and `_ensure_gh_user` calls.
2. Rewrite `auto-fix-issue/scripts/github.sh` into thin `engine_dispatch` shims, one per subcommand (`info`, `pr-create`, `pr-view`, `pr-ready`), mirroring how #428/#429 renamed their shell body and replaced the original with dispatch logic (exact file split — single renamed shell body vs. per-subcommand shell files — is an implementer's call). Forward `HOME` in the env allowlist for subcommands touching git/gh identity, consistent with existing shims.
3. Create `core/lib/commands/auto-fix-issue/AutoFixIssueGithub.js` (zero runtime deps, built-in Node APIs only), with one method per subcommand: `info`, `prCreate`, `prView`, `prReady`.
4. Register four separate entries in `core/lib/core/commands.js`'s `COMMANDS` map, each pointing at `AutoFixIssueGithub.js` with its own `method` (mirroring `AutoFixAllGithub.js`'s registration):
   - `'auto-fix-issue-github-info': { module: 'commands/auto-fix-issue/AutoFixIssueGithub.js', method: 'info', context: 'repo' }`
   - `'auto-fix-issue-github-pr-create': { module: 'commands/auto-fix-issue/AutoFixIssueGithub.js', method: 'prCreate', context: 'repo' }`
   - `'auto-fix-issue-github-pr-view': { module: 'commands/auto-fix-issue/AutoFixIssueGithub.js', method: 'prView', context: 'repo' }`
   - `'auto-fix-issue-github-pr-ready': { module: 'commands/auto-fix-issue/AutoFixIssueGithub.js', method: 'prReady', context: 'repo' }`
5. Reuse existing native equivalents rather than re-deriving them: `core/lib/utils/issue/Tags.js` (`extractTags`, for `tags.sh`), `core/lib/services/TagMutationService.js` (`addTag`/`removeTag`, for `tag_mutate.sh`), `core/lib/utils/git/Origin.js` (`resolve`/`resolveWithRef`, for `origin.sh`'s `_load_origin`/`get_repo_ref`), and `core/lib/utils/github/GithubToken.js` (already folds in `_ensure_gh_user` behavior via its `get()`). Add `createPr` and draft/ready-for-review support to `core/lib/utils/github/GitHubClient.js` (it currently has `getPr`/`mergePr`/`deleteBranch`/etc. but no PR-create or ready-for-review call) — this part is genuinely new, not a re-derivation.
6. Reuse `core/lib/commands/shared/IssueState.js` in-process (via its underlying service/`RepoContext` collaborator, not by shelling out to `core/bin/arcanum issue-state`) to persist `pr_url`/`pr_id` and refresh `tags`, mirroring how `PrOperations.js` calls `RepoContext#getIssueState`.
7. For `pr-view`'s "no pull requests found" case, use the `DispatchFailure` print-to-stdout-but-exit-1 contract documented in `docs/agents/architecture/script-engine.md`, so nothing is written to stderr — matching the shell script's silent exit-1 exactly.
8. Add `"auto-fix-issue-github": true` to `arcanum/_lib/migration-status.json`.
9. Write native unit tests under `core/spec/lib/commands/auto-fix-issue/`, split by subcommand/concern (mirroring `GithubIssue.js`'s and `AutoFixAllGithub.js`'s spec layout) rather than one monolithic spec file.
10. Write parity tests (shell vs. native, identical stdout/exit code), one file per subcommand under `core/spec/bin/autoFixIssueGithubParity/` (mirroring `autoFixAllGithubParity/`'s layout), run against the real rewritten `auto-fix-issue/scripts/github.sh` shim now that it's genuinely wired — plus a dedicated `engine_dispatch_spec.js` covering `engine.mode=native` and `engine.mode=shell` routing for all four subcommands.

Depends on the already-migrated `issue-state` command (`issue_state.sh`) and, structurally, on `auto-fix-issue-create-branch` (#429, merged) as the closest single-subcommand shim-rewrite precedent within this same script family. No other unmerged sub-issue in this batch blocks this one.

## Benefits

- Moves `auto-fix-issue` one entrypoint closer to running fully on the native engine, per the project's ongoing shell → Node.js migration.
- Unlike the `auto-fix-all-github` precedent, this migration actually wires `engine.mode` to control real production routing for all four subcommands, rather than leaving that as a deferred follow-up.
- Establishes parity test coverage that protects the exact stdout/exit-code contracts — including the `pr-view` silent-exit-1 edge case and the label/state sync side effects — against regressions.
- Reuses already-grown native building blocks (`Tags.js`, `Origin.js`, `TagMutationService.js`, `GithubToken.js`, `IssueState.js`) instead of re-deriving them, keeping the migration's net-new surface limited to the PR create/ready REST calls.
