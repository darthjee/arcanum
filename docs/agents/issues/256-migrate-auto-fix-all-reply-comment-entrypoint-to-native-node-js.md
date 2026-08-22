Sub-issue of #252 (batch overview). Part of the `auto-fix-all` family.

## Source script

`auto-fix-all/scripts/reply_comment.sh`

Posts an attributed reply comment on the current branch's PR: resolves the PR number, renders `auto-fix-all/templates/reply.tmpl.md` (substituting body/agent/model attribution), posts it via `gh pr comment --body-file -`, then pushes the current branch.

## Migration

Follow `docs/agents/architecture/script-engine.md`:

1. Read `auto-fix-all/scripts/reply_comment.sh` for its exact output/exit-code contract.
2. Create `core/lib/AutoFixAllReplyComment.js` (zero runtime deps, built-in Node APIs only; use the global `fetch` plus `gh auth token` for the GitHub REST call, per the doc's design — not the `gh` CLI subcommand).
3. Register in `core/bin/arcanum`'s `COMMANDS` map: `'auto-fix-all-reply-comment': { module: 'AutoFixAllReplyComment.js', method: 'run' }`.
4. Add `"auto-fix-all-reply-comment": true` to `arcanum/_lib/migration-status.json`.
5. Write native unit tests in `core/spec/AutoFixAllReplyComment_spec.js`.
6. Write a parity test (shell vs. native, identical stdout/exit code).
7. Verify `arcanum/_lib/engine_dispatch.sh` routes correctly for `engine.mode=native` and `engine.mode=shell`.

## External dependencies

- GitHub REST API: posts a PR comment (currently via `gh pr comment`). No real network calls in CI — mock/stub per `core/spec/support/fixtures/`.
- Calls `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` to resolve the PR number — **out-of-batch**, not yet migrated; shell out to it as-is for now.
- Reads the template file `auto-fix-all/templates/reply.tmpl.md` (plain string substitution — no external templating library, matches the zero-runtime-deps rule).
- Calls `push_current_branch` from `arcanum/_lib/push.sh` (not yet migrated) — re-derive the equivalent `git push` logic natively rather than shelling out.

## Dependencies on other sub-issues

None — no in-batch script calls this one or is called by it.
