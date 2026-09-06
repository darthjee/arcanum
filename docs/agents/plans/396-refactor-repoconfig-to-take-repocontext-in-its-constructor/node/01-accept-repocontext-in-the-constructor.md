# Accept repoContext in the constructor

Add a constructor to `RepoConfig` that stores an optional `repoContext`
(`this._repoContext = repoContext`), following `GithubIssue.js`'s dual-mode shape: an
optional first constructor parameter, `undefined` when unused. Both existing public
methods (`getSafeBranch`, `getIgnoredCheckPatterns`) keep their `repoPath` parameter, but
fall back to `this._repoContext.repoPath` whenever `repoPath` isn't passed explicitly
(`repoPath = repoPath ?? this._repoContext.repoPath`, or equivalent). Both calling styles
(explicit `repoPath` per call, or `repoContext`-at-construction with no per-call
`repoPath`) must keep working side by side — this step does not touch any caller.

Update the class-level JSDoc comment to mention the new constructor-injectable
`repoContext` alongside the existing zero-arg/per-method-`repoPath` behavior, matching
`GithubIssue.js`'s style.

## Files to Change

- `core/lib/utils/config/RepoConfig.js` — add the constructor; update `getSafeBranch` and
  `getIgnoredCheckPatterns` to fall back to `this._repoContext.repoPath`; update JSDoc.
- `core/spec/lib/utils/config/RepoConfig_spec.js` — add spec coverage that constructs
  `RepoConfig` with a `repoContext` (via `createRepoContextMock` from
  `core/spec/support/factories/repoContextFactory.js`) and omits `repoPath` on each call
  to `getSafeBranch`/`getIgnoredCheckPatterns`, asserting the same behavior as the
  existing per-call-`repoPath` cases. Leave the existing raw-temp-dir, per-call-`repoPath`
  cases untouched — both styles are still valid public API at the end of this step.
