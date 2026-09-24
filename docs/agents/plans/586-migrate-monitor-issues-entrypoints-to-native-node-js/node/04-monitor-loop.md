# The poll loop command

`core/lib/commands/monitor-issues/MonitorIssuesMonitorIssues.js` (`context: 'repo'`), `run()`:

1. Acquire nothing up front. As in the shell, the lock file path is `.claude/state/issue-monitor.lock` and is released on exit (the shell `trap _release_lock EXIT`). Resolve the repo ref (`RepoContext#resolve`) and the ghuser from step 02, then log `Starting issue monitor for repo=<ref> user=<user or <default>>`.
2. Loop forever: `await this._pollOnce()`. On error, log `ERROR in poll cycle — retrying after sleep`, then `await this._sleep(this._pollIntervalMs)` (default 5000).
3. `_pollOnce`:
   - Read `SINCE` from `issue-monitor-last-checked.txt`, defaulting to `1970-01-01T00:00:00Z`. Write `now − 1s`, formatted as `%FT%TZ` with no milliseconds.
   - Log `Polling issues updated since <SINCE> ...`. Run the step 02 search. On failure, log `ERROR: gh issue list failed: <msg>` and fail the cycle. Otherwise log `Got N issue(s) from GitHub.`
   - For each issue:
     - Compare `updatedAt` with the stored `IssueStateService#get(id, 'updated_at')`, defaulting to epoch, as strings. If it isn't newer, log the same `Skipping #<id> — not newer (...)` line and move on.
     - Compute `tags = Tags.extractTags(labels)`, then dispatch each of `Tags.actionableTags(labels)`:
       - `question`: log only.
       - `created`: `MonitorIssuesRewriteQueue#push(id)` in-process, writing its `Pushed:` line to stdout.
       - `ready_for_work`: `AutoFixAllQueue#push(id)` in-process, which also marks the issue enqueued.
       - Each dispatch has its own try/catch, uses the same log lines as the shell, and sets a failure flag when it fails.
     - Only if nothing failed: `IssueStateService#set(id, 'updated_at', now)` and `#setJson(id, 'tags', JSON.stringify(tags))`, then log `Processed #<id> — updated_at recorded`. Otherwise log the "Skipping updated_at write" line.
4. Injected dependencies: `sleepFn`, `pollIntervalMs`, a `clock` (returns a `Date`), and the collaborators (issue search client, `IssueStateService`, both queues, logger/stdout writer). Specs use them to run a bounded number of cycles, for example with a `sleepFn` that throws or aborts after N calls, or with a `maxCycles` option used only by tests.
5. Signals: on `SIGINT`/`SIGTERM`, release the lock and exit. The shell exits 130/143 through the trap, so match that. Remove the listeners once the run finishes so specs don't leak them.

## Files to Change
- `core/lib/commands/monitor-issues/MonitorIssuesMonitorIssues.js` — new
- `core/spec/lib/commands/monitor-issues/MonitorIssuesMonitorIssues*_spec.js` — cursor, skip-not-newer, per-tag dispatch, partial-failure no-record, cycle error recovery, signal cleanup
