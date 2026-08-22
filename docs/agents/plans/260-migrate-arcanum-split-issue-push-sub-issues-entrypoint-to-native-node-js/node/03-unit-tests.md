# Unit tests

Write `core/spec/lib/ArcanumSplitIssuePushSubIssues_spec.js` (Jasmine, mirroring `core/spec/lib/ArcanumSplitIssueCreateSubIssue_spec.js`'s fully fake-injected style — inject a stub `ArcanumSplitIssueCreateSubIssue` with a jasmine spy `run`, not the real one, so no real `gh`/network path is exercised here). Cover:

- **Zero matching files** — empty issues directory (or one with only unrelated files) → `STATUS=ok\nCREATED=\n`, the injected `createSubIssue.run` never called.
- **Multiple matching files, all succeed** — files created in an order that would sort incorrectly if processed unsorted (e.g. create `<id>_02_*.md` on disk before `<id>_01_*.md`) to prove the module sorts by path before dispatching; assert `createSubIssue.run` was called once per file **in ascending order**, and the final `CREATED=` list is comma-joined in that same order with the ids the stub returned.
- **Glob selectivity** — files that don't match `<issueId>_[0-9][0-9]*_*` (wrong issue id prefix, single-digit count, no second `_` after the count) are present in the directory but must be excluded from both the call list and `CREATED=`.
- **Mid-batch failure, `DispatchFailure` thrown by a later file** — first N files succeed, the next throws; assert the loop stops (files after the failure are never passed to `createSubIssue.run`), the thrown error is this module's own `DispatchFailure` with `STATUS=failed\nCREATED=<the N successes>\nFAILED=<the failing file>\n` and exit code 1, and — critically — that none of the upstream `DispatchFailure`'s own `.stdout` content leaks into the thrown payload (assert the message does NOT contain any text unique to the stub's thrown stdout).
- **Mid-batch failure, plain `Error` thrown instead of `DispatchFailure`** — same assertions as above, proving both error shapes are handled identically (matching the shell script's exit-code-only catch-all).
- **First file fails immediately** — `CREATED=` in the thrown payload is empty, `FAILED=` is the first file.
- **Usage errors** — missing `repoPath` or `issueId` throws the `Usage: push_sub_issues.sh <repo_path> <issue_id>` message.
- **`RepoPath#validate` rejection** — propagates uncaught, same as `ArcanumSplitIssueCreateSubIssue_spec.js`'s equivalent case.

## Files to Change

- `core/spec/lib/ArcanumSplitIssuePushSubIssues_spec.js` — new unit test file.
