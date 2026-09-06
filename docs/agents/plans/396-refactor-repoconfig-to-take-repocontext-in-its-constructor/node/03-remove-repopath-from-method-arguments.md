# Remove repoPath from method arguments

Drop the `repoPath` parameter and the step-01 fallback from both `RepoConfig` public
methods (`getSafeBranch`, `getIgnoredCheckPatterns`) — `repoContext` becomes the only
source of `repoPath`, now required at construction (no longer optional). Update the
class-level and per-method JSDoc to drop the repeated `@param {string} repoPath ...`
entries and document `repoContext` as a required constructor parameter instead, matching
the finished shape of `GithubIssue.js`'s dual-mode collaborators that have since dropped
their fallback.

Update `core/spec/lib/utils/config/RepoConfig_spec.js`: remove the now-invalid
per-call-`repoPath` test cases (the raw-temp-dir style from before step 01), keeping only
the `repoContext`-based construction added in step 01 via `createRepoContextMock`. Every
remaining `getSafeBranch`/`getIgnoredCheckPatterns` call in the spec omits `repoPath`.

Run `make core-test` and `make core-lint` after this step — this is the last step, and
both must pass/be clean per the issue's "Done when" criteria.

## Files to Change

- `core/lib/utils/config/RepoConfig.js` — remove the `repoPath` parameter and its
  constructor-fallback from `getSafeBranch` and `getIgnoredCheckPatterns`; update JSDoc.
- `core/spec/lib/utils/config/RepoConfig_spec.js` — remove per-call-`repoPath` test
  cases; keep only `repoContext`-based construction.
