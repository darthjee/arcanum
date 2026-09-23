# Migrate IssueClient to the helpers

Rewrite `IssueClient`'s five methods (`getIssue`, `addLabel`, `removeLabel`, `createIssue`, `postComment`) to use `repoRequest`/`repoRequestJson` instead of the explicit `repo()` → `failure` → path preamble. None of them do post-response validation, so all five qualify under the usage rule.

Keep error message text byte-for-byte identical (including the `Error: ` prefix where present), keep `encodeURIComponent(label)` in `removeLabel`'s path builder, and keep every method's return value (e.g. `addLabel`/`removeLabel`/`postComment` resolve to `undefined`). No other `IssueClient` restructuring.

`IssueClient_spec.js` and every caller spec (`IssueTagger`, `GithubIssue`, `AutoFixAllReplyComment`, parity specs) must pass unchanged — do not edit them to make them pass.

## Files to Change
- `core/lib/utils/github/IssueClient.js` — adopt the repo-scoped helpers in all five methods.
