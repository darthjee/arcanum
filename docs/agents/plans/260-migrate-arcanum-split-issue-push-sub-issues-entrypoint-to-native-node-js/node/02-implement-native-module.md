# Native module ArcanumSplitIssuePushSubIssues

Create `core/lib/ArcanumSplitIssuePushSubIssues.js`, zero runtime deps, following `core/lib/ArcanumSplitIssueCreateSubIssue.js`'s constructor-injection shape (`RepoPath` for validation, plus an injected `readdir` from `node:fs/promises` for testability). Per the issue's "External dependencies" note, this module calls `ArcanumSplitIssueCreateSubIssue#run` **directly in-process** — inject an `ArcanumSplitIssueCreateSubIssue` instance as a constructor dep (default `new ArcanumSplitIssueCreateSubIssue()`), not `execFile`/`child_process`.

This is why step 01's shim forwards `HOME` in its `engine_dispatch` call — because this module embeds `ArcanumSplitIssueCreateSubIssue`'s own call chain (`SpawnIssue` → `gh auth token` via `execFile`), the native side of the dispatch needs it even though `push_sub_issues_shell.sh` itself doesn't.

## Behavior — mirror `push_sub_issues.sh` exactly

1. Validate `repoPath`/`issueId` given (usage error otherwise, same `Usage: push_sub_issues.sh <repo_path> <issue_id>` message shape as the shell script), then `RepoPath#validate`.
2. List files directly under `<repoPath>/docs/agents/issues` whose basename matches the shell glob `${issueId}_[0-9][0-9]*_*` — i.e. `^${issueId}_[0-9]{2}.*_.*$` (build the regex from the escaped `issueId`) — and sort them ascending by full relative path (`docs/agents/issues/<basename>`) using default string sort, matching the shell script's `sort` over the same paths. No files matching → skip straight to the empty-success output below.
3. For each matched file, in order, call `this._createSubIssue.run(repoPath, issueId, relativeFilePath)`.
   - **Crucial:** unlike `ArcanumSplitIssueCreateSubIssue#run`'s own failure path (which echoes its upstream `SpawnIssue` output before appending its own `STATUS=failed`), `push_sub_issues.sh` never echoes `create_sub_issue.sh`'s stdout at all — bash's `OUTPUT=$(...)` capture only feeds `STATUS_LINE`/`ID_LINE` parsing, nothing from `OUTPUT` reaches this driver's own stdout on either the success or the failure path. So: on success, extract the new id from the resolved string's `ID=` line and discard the rest of the returned string; on any thrown error (whether `DispatchFailure` or a bare `Error` — treat both the same way, matching the shell script's `EXIT_CODE -ne 0` catch-all), discard the thrown error's own message/stdout entirely and stop the loop at this file.
4. On success for a file, append `<file>:<id>` to the accumulated `CREATED` list (comma-joined, same as the shell script).
5. On the first failure, build `STATUS=failed\nCREATED=<accumulated so far>\nFAILED=<file>\n` and throw it as a `DispatchFailure` (default exit code 1, matching the shell script's plain `exit 1`) — do not process remaining files.
6. If every file succeeds (or there were zero files to begin with), return `STATUS=ok\nCREATED=<accumulated>\n` (empty string after `CREATED=` when there were no files, exactly like the shell script's unset/empty `$CREATED`).

## Files to Change

- `core/lib/ArcanumSplitIssuePushSubIssues.js` — new native module.
