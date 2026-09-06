# Accept repoContext in the constructor

Add a constructor to `QueueStore` that stores an optional `repoContext`
(`this._repoContext = repoContext`), following `GithubIssue.js`'s dual-mode shape: an
optional first constructor parameter, `undefined` when unused. Every existing public
method (`read`, `write`, `queueFile`, `lockFile`) keeps its `repoPath` parameter, but
falls back to `this._repoContext.repoPath` whenever `repoPath` isn't passed explicitly
(`repoPath = repoPath ?? this._repoContext.repoPath`, or equivalent). Both calling styles
(explicit `repoPath` per call, or `repoContext`-at-construction with no per-call
`repoPath`) must keep working side by side — this step does not touch any caller.

Update the class-level JSDoc comment to mention the new constructor-injectable
`repoContext` alongside the existing zero-arg/per-method-`repoPath` behavior, matching
`GithubIssue.js`'s style.

## Files to Change

- `core/lib/utils/queue/QueueStore.js` — add the constructor; update `read`, `write`,
  `queueFile`, `lockFile` to fall back to `this._repoContext.repoPath`; update JSDoc.
- `core/spec/lib/utils/queue/QueueStore_spec.js` — add spec coverage that constructs
  `QueueStore` with a `repoContext` (via `createRepoContextMock` from
  `core/spec/support/factories/repoContextFactory.js`) and omits `repoPath` on each call
  to `read`/`write`/`queueFile`/`lockFile`, asserting the same behavior as the existing
  per-call-`repoPath` cases. Leave the existing raw-temp-dir, per-call-`repoPath` cases
  untouched — both styles are still valid public API at the end of this step.
