# Collapse internal duplication in AutoFixIssueGithubStateSync_spec.js

Refactor `core/spec/lib/commands/auto-fix-issue/AutoFixIssueGithubStateSync_spec.js` to build its `issueTagger`/`issueStateService`/`github` setup via `githubStateFixture()` (from step 01) instead of re-declaring the same jasmine-spy object literals in each `it`. Use the shared example (or call the fixture directly, whichever keeps each test's distinct assertion clear) to remove the ~5x repeated arrange/act block across the `#_syncPrLabelsAndState` tests (roughly the "adds the pr tag", "refreshes tags", "warns and stops", "tolerates a failed tags persistence", and "adds/does not add auto-shipit" cases).

Each test's own distinct behavior (mutateTag rejection, fetchLabels rejection, addLabel conditional on `shipit`, etc.) stays inline via fixture overrides — only the repeated boilerplate setup moves into the shared fixture/example.

## Files to Change

- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueGithubStateSync_spec.js` — replace inline `issueTagger`/`issueStateService` object literals with `githubStateFixture(...)` calls; keep per-test assertions and overrides intact.
