# Node Plan: Codacy: duplication cluster — GithubIssueService vs. shared GithubIssueCreate specs (59 clone groups, 2 files)

Main plan: [plan.md](plan.md)

## Steps

- [01 — Add the shared "create issue" example](node/01-add-shared-examples.md)
- [02 — Refactor GithubIssueCreate_spec.js to use the shared example](node/02-refactor-github-issue-create-spec.md)
- [03 — Refactor GithubIssueService_spec.js to use the shared example](node/03-refactor-github-issue-service-spec.md)

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)
- `core`: `yarn duplication` (CI job: `checks`, non-blocking — confirms the clone groups Codacy flagged for these two files are gone)

## Notes

- `GithubIssueService_spec.js` (`core/spec/lib/services/GithubIssueService_spec.js`) and `GithubIssueCreate_spec.js` (`core/spec/lib/commands/shared/GithubIssueCreate_spec.js`) both test `#create` on a different class — `GithubIssueService` (constructed as `new GithubIssueService(deps)`) vs. `GithubIssue`, the command wrapper (constructed as `new GithubIssue(undefined, deps)`) — but exercise identical request/response fixtures and assertions. The shared example must be parametrized by a factory that builds the instance under test, the same way `core/spec/support/sharedExamples/cliParityValidation.js` parametrizes by an `invoke` callback.
- Do not fold `GithubIssueService_spec.js`'s `repoContext`-fallback tests (`falls back to repoContext.repoPath...`, `prefers an explicit repoPath argument...`) or `GithubIssueCreate_spec.js`'s `resolves repoPath from the injected RepoContext and shifts the passed positionals` test into the shared example — these three tests exercise each wrapper's own, differently-shaped `repoPath`/`RepoContext` resolution and stay wrapper-specific, per the issue's acceptance criteria.
- Leave `GithubIssueService_spec.js`'s unrelated `describe` blocks (`GithubIssueService defaults`, `GithubIssueService#issueClient`, `GithubIssueService#rawString`, `GithubIssueService#normalizeTitle`) untouched — they are outside this duplication cluster.
