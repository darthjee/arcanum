# Unit tests

Split by subcommand/concern rather than one monolithic spec file — mirror `GithubIssue.js`'s (`GithubIssueCreate_spec.js`, `GithubIssueInfo_spec.js`, `GithubIssueFetch_spec.js`) and `AutoFixAllGithub.js`'s (`AutoFixAllGithubLabels_spec.js`, `AutoFixAllGithubWiring_spec.js`, `AutoFixAllGithubPrAndBranch_spec.js`) spec layout under `core/spec/lib/commands/auto-fix-issue/`:

- **`AutoFixIssueGithubInfo_spec.js`**: `info()` prints `DOMAIN=<domain>\nREPO=<repo>\n` from a mocked origin resolution.
- **`AutoFixIssueGithubPrCreate_spec.js`**: usage-error path (missing `title`/`file`), file-not-found error text, successful create (mocked `GitHubClient#createPr`) returning the URL, API-failure error text, and that `#_persistPrState`/`#_syncPrLabelsAndState` are invoked on success (and are no-ops off an `issue-<id>` branch).
- **`AutoFixIssueGithubPrView_spec.js`**: successful view (`URL=`/`IS_DRAFT=` output), and — the highest-value case — the "no PR found" path throwing `DispatchFailure` with an empty payload and exit code 1 (assert both the payload and the exit code, not just that *something* was thrown), versus a genuinely different lookup failure still producing the `Error: could not view PR on ...` stderr text.
- **`AutoFixIssueGithubPrReady_spec.js`**: successful mark-ready (`OK\n`), API-failure error text, and the same `#_persistPrState`/`#_syncPrLabelsAndState` invocation coverage as `pr-create`.
- **`AutoFixIssueGithubStateSync_spec.js`**: the shared `#_persistPrState`/`#_syncPrLabelsAndState` helpers directly (if extracted onto the class as testable methods) — PR-number extraction from the URL, the `pr` tag mutation call going through `IssueTagger#mutateTag` (best-effort — assert a mutation failure doesn't throw), the `tags` refresh via `Tags.extractTags` + `IssueStateService#setJson`, and the conditional `auto-shipit` PR-label add only when `shipit` is among the refreshed tags.

For `GitHubClient.js`'s new methods, extend `core/spec/lib/utils/github/GitHubClient_spec.js` (or split if it's grown large already — check its current size before deciding) with cases for `createPr` (default-branch resolution, REST payload shape, returned URL) and the new GraphQL-backed ready-for-review method (request shape, node-id input, error handling on a non-ok/GraphQL-errors response).

## Files to Change

- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueGithubInfo_spec.js` — new.
- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueGithubPrCreate_spec.js` — new.
- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueGithubPrView_spec.js` — new.
- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueGithubPrReady_spec.js` — new.
- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueGithubStateSync_spec.js` — new.
- `core/spec/lib/utils/github/GitHubClient_spec.js` — extend (or split) for the two new methods.
