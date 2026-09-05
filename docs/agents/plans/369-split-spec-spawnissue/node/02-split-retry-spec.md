# Split off the retry spec file

Create `core/spec/lib/commands/shared/SpawnIssueRetry_spec.js`. Import `DispatchFailure`,
`RepoContext` is no longer imported directly (only used inside the factory's `buildContext`),
`SpawnIssue`, `createTempDir`/`removeTempDir` the same way the original spec does, plus
`stubDeps`, `buildContext`, `CREATE_OUTPUT` from
`../../../support/factories/spawnIssue.js`. Keep this file's own `beforeEach`/`afterEach` for
the per-test `repoPath` (`createTempDir`/`removeTempDir`) and `bodyFile` (`writeFile`) — same
as the original.

Top-level shape:

```js
describe('SpawnIssue#run (retry behavior)', () => {
  // the 3 `it`s currently under `retry exhaustion`, plus the 1 `it` currently under
  // `retry then success` — moved verbatim (same descriptions, same bodies, same assertions),
  // each call site now passing `buildContext(repoPath, { ... })` per step 01
});
```

Move all 4 `it`s unchanged: the `retry exhaustion` block's 3 `it`s (default 5-attempt
exhaustion, custom `configChain` retry-count/sleep-time, non-numeric `configChain` fallback
to 5/5 — currently lines 64–139) and the `retry then success` block's 1 `it` (resolves after
the second attempt — currently lines 141–173).

## Files to Change

- `core/spec/lib/commands/shared/SpawnIssueRetry_spec.js` — new file; the 4 `it`s from the
  original `retry exhaustion`/`retry then success` blocks plus the imports described above.
