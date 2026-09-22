# Migrate all 5 specs to the fixture

Replace each spec's local `beforeEach`/`afterEach` temp-dir lifecycle with a call to `splitIssueCommandFixture()` from `../../../support/factories/splitIssueCommandFixture.js` (`../../support/factories/...` for `IssueState_spec.js`, one level shallower under `commands/shared/`):

- `ArcanumSplitIssueFinish_spec.js` (L27-33) and `ArcanumSplitIssuePushSubIssues_spec.js` (L39-47): `const fixture = splitIssueCommandFixture();`, then replace reads of the local `repoPath` variable with `fixture.repoPath`.
- `ArcanumSplitIssueCreateSubIssue_spec.js` (L27-38): `const fixture = splitIssueCommandFixture({ seedFile: { name: 'draft.md', content: '# My Sub Issue\n\nFirst line of body.\n' } });`, replacing `repoPath`/`subIssueFile` reads with `fixture.repoPath`/`fixture.seedFilePath`.
- `ArcanumSplitIssueCreateSubIssueFile_spec.js` (L21-32): `const fixture = splitIssueCommandFixture({ seedFile: { name: 'body.md', content: '' } });`, replacing `repoPath`/`bodyFile` reads with `fixture.repoPath`/`fixture.seedFilePath`.
- `IssueState_spec.js` (L10, L34-40): `const fixture = splitIssueCommandFixture({ prefix: 'arcanum-core-issue-state-spec-' });`, replacing `repoPath` reads with `fixture.repoPath`.

Remove the now-unused `createTempDir`/`removeTempDir` (and, where no longer needed, `path`/`writeFile`) imports from each of the 5 specs once their local lifecycle code is gone.

Run `yarn test` (from `core/`) after this step — all 5 specs must still pass with unchanged coverage.

## Files to Change

- `core/spec/lib/commands/arcanum-split-issue/ArcanumSplitIssueFinish_spec.js` — swap local temp-dir lifecycle for the fixture.
- `core/spec/lib/commands/arcanum-split-issue/ArcanumSplitIssuePushSubIssues_spec.js` — swap local temp-dir lifecycle for the fixture.
- `core/spec/lib/commands/arcanum-split-issue/ArcanumSplitIssueCreateSubIssue_spec.js` — swap local temp-dir lifecycle + seed-file write for the fixture.
- `core/spec/lib/commands/arcanum-split-issue/ArcanumSplitIssueCreateSubIssueFile_spec.js` — swap local temp-dir lifecycle + seed-file write for the fixture.
- `core/spec/lib/commands/shared/IssueState_spec.js` — swap local temp-dir lifecycle (custom prefix) for the fixture.
