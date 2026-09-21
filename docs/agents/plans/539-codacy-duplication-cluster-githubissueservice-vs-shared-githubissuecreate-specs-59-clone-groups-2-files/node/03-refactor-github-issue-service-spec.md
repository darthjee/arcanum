# Refactor GithubIssueService_spec.js to use the shared example

Update `core/spec/lib/services/GithubIssueService_spec.js`'s `describe('GithubIssueService#create', ...)` block to call `registerGithubIssueCreateSharedExamples((deps) => new GithubIssueService(deps))` from the new shared-example file (step 01) instead of hand-writing the 8 duplicated scenarios and their setup.

Keep this file's own `#create`-specific tests, using the `repoPath`/`writeBodyFile` the shared example now exposes:

- `falls back to repoContext.repoPath when no repoPath argument is passed` (currently lines 146-156)
- `prefers an explicit repoPath argument over the constructor repoContext` (currently lines 158-180)

Remove the now-redundant local `beforeEach`/`afterEach`/`writeBodyFile` and the 8 duplicated `it` blocks this file previously held (currently lines 8-144).

Leave the rest of the file untouched — the `GithubIssueService defaults`, `GithubIssueService#issueClient`, `GithubIssueService#rawString`, and `GithubIssueService#normalizeTitle` `describe` blocks (currently lines 183-308) are outside this duplication cluster.

## Files to Change

- `core/spec/lib/services/GithubIssueService_spec.js` — replace the duplicated setup/scenarios with a call to the shared example; keep the `repoContext`-fallback tests and the unrelated `describe` blocks.
