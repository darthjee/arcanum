# Refactor GithubIssueCreate_spec.js to use the shared example

Update `core/spec/lib/commands/shared/GithubIssueCreate_spec.js`'s `describe('GithubIssue#create', ...)` block to call `registerGithubIssueCreateSharedExamples((deps) => new GithubIssue(undefined, deps))` from the new shared-example file (step 01) instead of hand-writing the 8 duplicated scenarios and their setup.

Keep only this file's own wrapper-specific test, using the `repoPath`/`writeBodyFile` the shared example now exposes:

- `resolves repoPath from the injected RepoContext and shifts the passed positionals` (currently lines 146-171) — exercises `GithubIssue`'s own `RepoContext`-based positional-shift behavior, which `GithubIssueService` does not share in the same shape.

Remove the now-redundant local `beforeEach`/`afterEach`/`writeBodyFile` and the 8 duplicated `it` blocks this file previously held.

## Files to Change

- `core/spec/lib/commands/shared/GithubIssueCreate_spec.js` — replace the duplicated setup/scenarios with a call to the shared example; keep only the `RepoContext` positional-shift test.
