# Split off the argument-validation spec file

Create `core/spec/lib/commands/shared/SpawnIssueArgumentValidation_spec.js`. Import
`SpawnIssue`, `path`, `createTempDir`/`removeTempDir` the same way the original spec does,
plus `stubDeps`, `buildContext` from `../../../support/factories/spawnIssue.js`. Keep this
file's own `beforeEach`/`afterEach` for the per-test `repoPath`/`bodyFile`.

Top-level shape:

```js
describe('SpawnIssue#run (argument validation)', () => {
  // the 3 `it`s currently under `argument validation` — moved verbatim, each call site now
  // passing `buildContext(repoPath, { ... })` per step 01 (the no-repoPath test passes `''`
  // as the first argument instead of `{ repoPath: '', ... }`)
});
```

Move all 3 `it`s unchanged (currently lines 232–265): rejects when the context has no
`repoPath` (via `buildContext('', { githubIssue })`), rejects a body file that does not
exist, rejects an unrecognized 5th argument.

## Files to Change

- `core/spec/lib/commands/shared/SpawnIssueArgumentValidation_spec.js` — new file; the 3
  `it`s from the original `argument validation` block plus the imports described above.
