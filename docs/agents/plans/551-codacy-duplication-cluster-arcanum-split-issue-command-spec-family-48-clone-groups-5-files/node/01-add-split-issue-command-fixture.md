# Add the splitIssueCommandFixture factory

Create `core/spec/support/factories/splitIssueCommandFixture.js`, a new ESM module following the `core/spec/support/factories/` directory convention (named exports only, JSDoc per export, importing `node:path` and `node:fs/promises` plus `createTempDir`/`removeTempDir` from `../utils/tempDir.js`).

Export a single helper, e.g. `splitIssueCommandFixture({ prefix, seedFile } = {})`, that:

- Registers a `beforeEach` creating a temp repo dir via `createTempDir(prefix)` (falling back to `tempDir.js`'s own default when `prefix` is omitted, preserving `IssueState_spec.js`'s custom `'arcanum-core-issue-state-spec-'` prefix use case).
- When `seedFile` is given (`{ name, content }`), writes `path.join(repoPath, seedFile.name)` with `seedFile.content ?? ''` during the same `beforeEach`, covering `ArcanumSplitIssueCreateSubIssue_spec.js`'s `draft.md` and `ArcanumSplitIssueCreateSubIssueFile_spec.js`'s `body.md` cases.
- Registers an `afterEach` calling `removeTempDir(repoPath)`.
- Returns a mutable state object (e.g. `{ repoPath, seedFilePath }`, populated once `beforeEach` runs) that the calling spec reads inside its `it` blocks — mirroring how the specs currently read their own `let repoPath;`/`let subIssueFile;` closures.

This step only adds the new file — no existing spec changes yet.

## Files to Change

- `core/spec/support/factories/splitIssueCommandFixture.js` — new fixture factory.
