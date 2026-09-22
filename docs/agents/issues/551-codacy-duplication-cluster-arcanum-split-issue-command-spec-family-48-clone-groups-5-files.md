# Issue: Codacy: duplication cluster — arcanum-split-issue command spec family (48 clone groups, 5 files)

## Context

Five specs share a `createTempDir`/`removeTempDir` lifecycle fragment (7-9 lines), with real variation between them:

- `core/spec/lib/commands/arcanum-split-issue/ArcanumSplitIssueFinish_spec.js` and `ArcanumSplitIssuePushSubIssues_spec.js` have a byte-identical 7-line `beforeEach`/`afterEach` pair.
- `ArcanumSplitIssueCreateSubIssue_spec.js` and `ArcanumSplitIssueCreateSubIssueFile_spec.js` extend it with an extra `path.join`+`writeFile` line seeding a draft/body file (9 lines, same shape, different filename/content).
- `core/spec/lib/commands/shared/IssueState_spec.js` uses a custom temp-dir prefix (`createTempDir('arcanum-core-issue-state-spec-')`).

There is no existing shared-fixture convention for `core/spec/lib/commands/` unit specs — the only precedent, `core/spec/support/factories/*ParitySetup.js`, is scoped to `core/spec/bin/*Parity/*_spec.js` (shell-vs-native parity tests), not unit specs.

`ArcanumSplitIssueFinish_spec.js` additionally has 4 variants of a "finish and report" assertion (not 3, and not at the line numbers originally reported, which were stale): 2 full multi-line `Deleted:...BRANCH=...` blocks (currently ~L96-122 and ~L172-186) and 2 lighter single-line "(nothing to clean up)" variants (currently ~L124-136 and ~L138-145).

CreateSubIssueFile_spec.js and IssueState_spec.js also each define a near-identical no-op `stubDeps` passthrough helper (`{ ...overrides }`) that adds no value beyond documentation.

## What needs to be done

- Add a parameterized `splitIssueCommandFixture({ prefix, seedFile })` factory under `core/spec/support/factories/` (following the `*ParitySetup.js` location convention) covering the temp-dir create/remove lifecycle, with an optional seed-file write for the two specs that need it.
- Use this fixture in all five specs, removing their local `beforeEach`/`afterEach` duplication.
- Remove the near-duplicate no-op `stubDeps` passthrough helpers in `ArcanumSplitIssueCreateSubIssueFile_spec.js` and `IssueState_spec.js`, replacing their use with the shared fixture.
- Collapse the 4 "finish and report" assertion variants in `ArcanumSplitIssueFinish_spec.js` (2 full blocks + 2 lighter "(nothing to clean up)" variants) into a single `it.each` table.

## Acceptance criteria

- [ ] A parameterized `splitIssueCommandFixture()` factory exists under `core/spec/support/factories/` and is used by all five listed specs for the temp-dir create/remove lifecycle (with optional seed-file support).
- [ ] The near-duplicate no-op `stubDeps` passthroughs in `ArcanumSplitIssueCreateSubIssueFile_spec.js` and `IssueState_spec.js` are removed/replaced by the shared fixture.
- [ ] All 4 "finish and report" assertion variants in `ArcanumSplitIssueFinish_spec.js` are collapsed into a single parameterized `it.each` test.
- [ ] All five specs pass with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this family drops substantially after the fix lands.
