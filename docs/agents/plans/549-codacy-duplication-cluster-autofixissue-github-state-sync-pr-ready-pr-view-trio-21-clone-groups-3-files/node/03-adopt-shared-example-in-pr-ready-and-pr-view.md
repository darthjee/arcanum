# Adopt the shared example in the pr-ready/pr-view specs

In `core/spec/lib/commands/auto-fix-issue/AutoFixIssueGithubPrReady_spec.js` and `core/spec/lib/commands/auto-fix-issue/AutoFixIssueGithubPrView_spec.js`, replace each file's "persists pr state and syncs labels/tags when on an issue-<id> branch" test (and its paired off-branch no-op test) with the `syncsGithubState(...)` shared example from step 01, exercising `github.prReady()`/`github.prView()` respectively as the `exercise` callback.

Keep each file's other tests (mark-ready/mark-ready-failure error text, prView's URL/IS_DRAFT stdout shape and `DispatchFailure` rejection, the best-effort re-fetch tolerance) unchanged — only the duplicated state-sync setup/assertion fragment moves onto the shared example.

## Files to Change

- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueGithubPrReady_spec.js` — adopt `syncsGithubState(...)` for the state-persistence/label-sync scenario, keep the rest of the spec as-is.
- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueGithubPrView_spec.js` — adopt `syncsGithubState(...)` for the state-persistence scenario, keep the rest of the spec as-is.
