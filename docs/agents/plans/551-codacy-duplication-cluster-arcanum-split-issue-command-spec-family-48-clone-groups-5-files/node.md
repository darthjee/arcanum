# Plan: Codacy: duplication cluster — arcanum-split-issue command spec family (48 clone groups, 5 files)

Issue: [551-codacy-duplication-cluster-arcanum-split-issue-command-spec-family-48-clone-groups-5-files.md](../../issues/551-codacy-duplication-cluster-arcanum-split-issue-command-spec-family-48-clone-groups-5-files.md)

## Context

All 5 specs already import `{ createTempDir, removeTempDir }` from `core/spec/support/utils/tempDir.js` (`createTempDir(prefix = 'arcanum-core-spec-')`, `removeTempDir(dir)`) and duplicate a `beforeEach`/`afterEach` pair around it:

- `ArcanumSplitIssueFinish_spec.js` (L27-33) and `ArcanumSplitIssuePushSubIssues_spec.js` (L39-47): identical — `let repoPath;` / `repoPath = await createTempDir();` / `await removeTempDir(repoPath);` — default prefix, no seed file.
- `ArcanumSplitIssueCreateSubIssue_spec.js` (L27-38): same shape, plus `subIssueFile = path.join(repoPath, 'draft.md'); await writeFile(subIssueFile, '# My Sub Issue\n\nFirst line of body.\n');`.
- `ArcanumSplitIssueCreateSubIssueFile_spec.js` (L21-32): same shape, plus `bodyFile = path.join(repoPath, 'body.md'); await writeFile(bodyFile, '');`.
- `IssueState_spec.js` (commands/shared/, L10, L34-40): same shape but with a custom prefix — `createTempDir('arcanum-core-issue-state-spec-')` — no seed file.

`core/spec/support/factories/` already holds `*ParitySetup.js` files (e.g. `arcanumSplitIssuePushSubIssuesParitySetup.js`) for `core/spec/bin/*Parity/*_spec.js` — plain ESM modules, named exports only (no default export), each documented with a JSDoc block (not ESLint-enforced for `spec/**/*.js`, but followed by convention), importing node builtins plus sibling `support/utils/` helpers. None of them currently wrap the temp-dir lifecycle itself — that's new ground the fixture in this plan establishes, reusing the directory convention (not the `ParitySetup` suffix, since this isn't a parity fixture).

`ArcanumSplitIssueFinish_spec.js` also has 4 "finish and report" variants that only differ in what files are seeded beforehand and the expected resolved string of `instance.run(ISSUE_ID)`:

- Full block A (L96-122): seeds 3 matching + 2 non-matching files → `'Deleted:\n  .../first.md\n  .../second.md\n  .../third.md\nBRANCH=main\n'` + a remaining-files assertion.
- Light variant A (L124-136): seeds 1 unrelated file → `'Deleted: (nothing to clean up)\nBRANCH=main\n'`.
- Light variant B (L138-145): no setup at all → same `'Deleted: (nothing to clean up)\nBRANCH=main\n'`.
- Full block B (L172-186, inside `describe('full success path')`): seeds 1 matching file → `` `Deleted:\n  ${ISSUES_DIR}/${ISSUE_ID}-split.md\nBRANCH=main\n` ``.

All 4 share identical `stubDeps()`/instance construction, differing only in seeded files, expected result, and description — a natural data-driven table. **Jasmine (v7, per `core/package.json`) has no built-in `it.each`** — use a `for...of` loop over a rows array calling `it(description, async () => {...})` per row instead.

`ArcanumSplitIssueCreateSubIssueFile_spec.js` and `IssueState_spec.js` each define a local `stubDeps(overrides = {}) { return { ...overrides }; }` — a pure passthrough:

- `CreateSubIssueFile_spec.js`: called 17 times, always as `stubDeps()` with no args — fully removable.
- `IssueState_spec.js`: called 8 times as `stubDeps()`, plus once (L94) as `stubDeps({ issueStatePaths: { paths: pathsSpy } })` — the one real-override call site must pass `{ issueStatePaths: { paths: pathsSpy } }` directly once the wrapper is gone.

## Steps

- [01 — Add the splitIssueCommandFixture factory](node/01-add-split-issue-command-fixture.md)
- [02 — Migrate all 5 specs to the fixture](node/02-migrate-specs-to-fixture.md)
- [03 — Remove the no-op stubDeps passthroughs](node/03-remove-stub-deps-no-ops.md)
- [04 — Collapse Finish_spec's 4 assertion variants](node/04-collapse-finish-spec-assertions.md)

## CI Checks

- `core/`: `yarn test` (CI job: `test`)
- `core/`: `yarn lint` (CI job: `checks`)
- `core/`: `yarn duplication` (CI job: `checks`, non-blocking — this is what should visibly improve)

## Notes

- Keep `IssueState_spec.js`'s custom temp-dir prefix (`'arcanum-core-issue-state-spec-'`) working through the fixture's `prefix` option — don't silently drop it to the default.
- The fixture's exact API (e.g. a `splitIssueCommandFixture({ prefix, seedFile } = {})` helper that calls `beforeEach`/`afterEach` internally and returns a mutable state object with `repoPath` plus any seeded file path) is a design choice for the implementing step — the constraint is that all 5 specs end up calling it instead of hand-rolling their own `beforeEach`/`afterEach`.
- Run `yarn test` after each step (not just at the end) to keep the family green throughout, since Steps 2-4 each touch different specs' passing behavior.
