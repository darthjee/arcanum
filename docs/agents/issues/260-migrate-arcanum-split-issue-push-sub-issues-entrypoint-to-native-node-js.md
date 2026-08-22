Sub-issue of #252 (batch overview). Part of the `arcanum-split-issue` family.

## Source script

`arcanum-split-issue/scripts/push_sub_issues.sh`

Batch driver: pushes every generated sub-issue draft file for `<issue_id>` to GitHub, in ascending count order, via `create_sub_issue.sh`, stopping at the first failure. Prints `STATUS=ok`/`CREATED=<file>:<id>,...` on success (or `STATUS=failed`/`CREATED=...`/`FAILED=<file>` on the first failure, exit 1).

## Migration

Previously blocked on the sub-issue migrating `arcanum-split-issue-create-sub-issue` (#259), since this script is a thin per-file driver loop over it. That sub-issue is now merged (`core/lib/ArcanumSplitIssueCreateSubIssue.js` exists, `arcanum-split-issue-create-sub-issue: true` in `arcanum/_lib/migration-status.json`), so this issue is unblocked.

Follow `docs/agents/architecture/script-engine.md`:

1. Read `arcanum-split-issue/scripts/push_sub_issues.sh` for its exact output/exit-code contract.
2. Create `core/lib/ArcanumSplitIssuePushSubIssues.js` (zero runtime deps, built-in Node APIs only).
3. Register in `core/bin/arcanum`'s `COMMANDS` map: `'arcanum-split-issue-push-sub-issues': { module: 'ArcanumSplitIssuePushSubIssues.js', method: 'run' }`.
4. Add `"arcanum-split-issue-push-sub-issues": true` to `arcanum/_lib/migration-status.json`.
5. Write native unit tests in `core/spec/ArcanumSplitIssuePushSubIssues_spec.js`.
6. Write a parity test (shell vs. native, identical stdout/exit code).
7. Verify `arcanum/_lib/engine_dispatch.sh` routes correctly for `engine.mode=native` and `engine.mode=shell`.

## External dependencies

- Directory scan under `docs/agents/issues/` (local filesystem only, no GitHub API calls of its own).
- Invokes `create_sub_issue.sh` per file in the shell version — the native module (`ArcanumSplitIssueCreateSubIssue`, from #259) now exists, so the native implementation should call its `run` method directly in-process instead of shelling out.

## Dependencies on other sub-issues

Depended on `arcanum-split-issue-create-sub-issue`'s migration (#259) landing first — that dependency is now satisfied.
