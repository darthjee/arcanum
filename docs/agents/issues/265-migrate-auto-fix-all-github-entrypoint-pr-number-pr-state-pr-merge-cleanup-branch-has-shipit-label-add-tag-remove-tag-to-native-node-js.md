Sub-issue of #252 (batch overview). Part of the `auto-fix-all` family. This is the largest and most complex script in the batch (257 lines) — budget accordingly.

## Source script

`auto-fix-all/scripts/github.sh`

GitHub operations for auto-fix-all, with 7 subcommands: `pr-number`, `pr-state`, `pr-merge [model_email]`, `cleanup-branch <id>`, `has-shipit-label <id>`, `add-tag <id> <tag>`, `remove-tag <id> <tag>`.

## Migration

Follow `docs/agents/architecture/script-engine.md` — this script has multiple subcommands, so it migrates to **one module with multiple methods**, one `COMMANDS` entry per subcommand (same precedent as `github-issue-create`/`github-issue-info` both mapping to `GithubIssue.js`):

1. Read `auto-fix-all/scripts/github.sh` for its exact output/exit-code contract (all 7 subcommands).
2. Create `core/lib/ConfigChain.js`: a reusable 3-tier config reader (`local state → repo config → global config`, multi-key-per-tier precedence), the native equivalent of `arcanum/_lib/config_chain.sh`'s `config_chain_read` — see the "External dependencies" section below for why this is extracted rather than embedded inline.
3. Create `core/lib/AutoFixAllGithub.js` (zero runtime deps, built-in Node APIs only; use the global `fetch` plus `gh auth token` for GitHub REST calls per the doc's design, not `gh pr view`/`gh pr merge`/`gh issue view` CLI subcommands; any `git` invocation must use `execFile`/`spawn` with an argument array, never string-interpolated `exec()`) with methods `prNumber`, `prState`, `prMerge`, `cleanupBranch`, `hasShipitLabel`, `addTag`, `removeTag`, built on `ConfigChain.js` (for `prMerge`'s body-mode logic) and `Tags.js` (for `addTag`/`removeTag`'s label mapping, reusing `AutoFixAllQueue.js`'s existing mutation shape — see below).
4. Register in `core/bin/arcanum`'s `COMMANDS` map:
   - `'auto-fix-all-github-pr-number': { module: 'AutoFixAllGithub.js', method: 'prNumber' }`
   - `'auto-fix-all-github-pr-state': { module: 'AutoFixAllGithub.js', method: 'prState' }`
   - `'auto-fix-all-github-pr-merge': { module: 'AutoFixAllGithub.js', method: 'prMerge' }`
   - `'auto-fix-all-github-cleanup-branch': { module: 'AutoFixAllGithub.js', method: 'cleanupBranch' }`
   - `'auto-fix-all-github-has-shipit-label': { module: 'AutoFixAllGithub.js', method: 'hasShipitLabel' }`
   - `'auto-fix-all-github-add-tag': { module: 'AutoFixAllGithub.js', method: 'addTag' }`
   - `'auto-fix-all-github-remove-tag': { module: 'AutoFixAllGithub.js', method: 'removeTag' }`
5. Add `"auto-fix-all-github": true` to `arcanum/_lib/migration-status.json`.
6. Write native unit tests in `core/spec/ConfigChain_spec.js` (the 3-tier resolution and multi-key-per-tier precedence) and `core/spec/AutoFixAllGithub_spec.js` (covering all 7 subcommands).
7. Write parity tests (shell vs. native, identical stdout/exit code) for each subcommand.
8. Verify `arcanum/_lib/engine_dispatch.sh` routes correctly for `engine.mode=native` and `engine.mode=shell`.

## External dependencies

- GitHub REST API: PR lookup/merge, issue label read (currently via `gh pr view`/`gh pr merge`/`gh issue view`). No real network calls in CI: mock/stub via `core/spec/support/fixtures/`.
- `git push --delete` / `git checkout` / `git reset --hard` / `git branch -D` for `cleanup-branch`.
- `GH_INSECURE_SKIP_VERIFY=true` (set before shelling to `gh` in the shell version) is `gh`-CLI-specific — confirmed by precedent: the already-migrated `GithubIssue.js` and `AutoFixAllQueue.js` both call the GitHub REST API via `fetch` and neither sets or checks any TLS-related env var. No native equivalent needed.
- `pr-number` and `pr-merge` read a cached `pr_id`/`pr_url` from `arcanum/_lib/issue_state.sh` first — **already migrated** as `core/lib/IssueState.js` (`issue-state` command, `true` in `migration-status.json`). Reuse the native `IssueState` class directly for the cache lookup.
- `pr-merge`'s body-mode logic (`empty`/`full`/`coauthors`) sources `arcanum/_lib/merge_body.sh`, which itself sources `arcanum/_lib/config_chain.sh` (3-tier `local state → repo config → global config` resolution) and `arcanum/_lib/agent_email.sh` (for `model_coauthor_omitted`/`remove_coauthors_list`, both themselves built on `config_chain_read`). **No native 3-tier config-chain reader exists yet anywhere in `core/lib/`** — `RepoConfig.js` only does single-tier reads, and `AutoFixAllConfig.js` re-derives its own narrower new/legacy-file resolution, not the full 3-tier chain. This migration is the first entrypoint that needs one.
  - **Decision**: extract it as a reusable `core/lib/ConfigChain.js`, following the same precedent as `Tags.js` and `GithubToken.js` — both were built for one entrypoint's need but exported for reuse by later migrations (`Tags.js`'s `LABEL_TO_TAG` is already reused by `AutoFixAllQueue.js`). A future entrypoint needing 3-tier config resolution (e.g. `engine.mode` itself, per `docs/agents/architecture/script-engine.md`) should reuse `ConfigChain.js` rather than re-deriving the chain again. This does not conflict with the script-engine doc's "no standalone, wholesale `_lib` migration" scope boundary — it's still one entrypoint's need driving the extraction, just built reusably like its predecessors.
  - Re-derive `merge_body_mode` (default `empty`, warn-and-fallback on an unrecognized configured value) and `merge_body_coauthors_list`'s dedup/exclusion logic (dedupe by email, drop the merger's own login, optionally drop `model_email`, drop any email in `remove_coauthors`) as part of `AutoFixAllGithub.js`, built on top of `ConfigChain.js`.
  - `merge_body_coauthors_list`'s `gh pr view --json commits` (per-commit author name/email/login) and `gh api user -q '.login'` (current authenticated user's login) both need REST equivalents: `GET /repos/{repo}/pulls/{number}/commits` (each commit's `commit.author` for name/email, `.author.login` for the GitHub login) and `GET /user` (the token's own `.login`), respectively.
- `add-tag`/`remove-tag` source `arcanum/_lib/tags.sh` + `tag_mutate.sh`. **Reuse the existing native precedent directly** rather than re-deriving from scratch: `AutoFixAllQueue.js` already implements this exact shape (`_mutateTag`/`_fetchLabels`/`_addLabel`/`_removeLabel`, built on `Tags.js`'s exported `LABEL_TO_TAG` table inverted to `TAG_TO_LABEL`) for its own best-effort label mutation of `enqueued`/`ready_for_work`/`created`. One behavioral gap to close when reusing this shape here: `tag_mutate.sh` refuses to mutate the `shipit` tag ("shipit is human-only; scripts must not add or remove it", exit 1) — `AutoFixAllQueue.js`'s version never needed this guard since it never touches `shipit`, but `add-tag`/`remove-tag` are exposed directly with an arbitrary `<tag>` argument, so this guard must be added.
- `pr-merge`'s `gh pr merge --delete-branch` flag deletes the head branch on GitHub as part of the merge call — the REST merge endpoint (`PUT /repos/{repo}/pulls/{number}/merge`) has no equivalent flag. Native `prMerge` must issue an explicit follow-up `DELETE /repos/{repo}/git/refs/heads/{branch}` after a successful merge to preserve this behavior, tolerating "already deleted" the same way `cleanup-branch`'s own remote-delete already tolerates "not found".

## Dependencies on other sub-issues

None blocking this one. Note: the sibling sub-issue for `auto-fix-all-wait-ci-and-merge` (last in the batch) depends on this migration landing first, since `wait_ci_and_merge.sh` directly invokes `github.sh pr-merge`.
