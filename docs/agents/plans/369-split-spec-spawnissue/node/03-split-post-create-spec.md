# Split off the post-create spec file

Create `core/spec/lib/commands/shared/SpawnIssuePostCreate_spec.js`. Import `SpawnIssue`,
`createTempDir`/`removeTempDir`, `path` (needed for the scratch-file assertions'
`FILE=docs/agents/issues/...` string, not for path-joining) the same way the original spec
does, plus `stubDeps`, `buildContext`, `REPO_REF`, `CREATE_OUTPUT` from
`../../../support/factories/spawnIssue.js`. Keep this file's own `beforeEach`/`afterEach` for
the per-test `repoPath`/`bodyFile`.

Top-level shape:

```js
describe('SpawnIssue#run (post-create side effects)', () => {
  // the 2 `it`s currently under `delegation to LabelApplicator/IssueLinker`, plus the 1 `it`
  // currently under `scratch-file cleanup failure` — moved verbatim, each call site now
  // passing `buildContext(repoPath, { ... })` per step 01
});
```

Move all 3 `it`s unchanged: the `delegation to LabelApplicator/IssueLinker` block's 2 `it`s
(labels applied + link called with resolved `repoRef`/ids/title/`asSubissue` true; link called
with `asSubissue` false when the flag is absent — currently lines 175–200) and the
`scratch-file cleanup failure` block's 1 `it` (warns with the loud multi-line stderr block but
still resolves `STATUS=ok` — currently lines 202–229).

## Files to Change

- `core/spec/lib/commands/shared/SpawnIssuePostCreate_spec.js` — new file; the 3 `it`s from
  the original `delegation to LabelApplicator/IssueLinker`/`scratch-file cleanup failure`
  blocks plus the imports described above.
