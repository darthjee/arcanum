# Collapse Finish_spec's 4 assertion variants

In `ArcanumSplitIssueFinish_spec.js`, replace the 4 separate "finish and report" tests with one data-driven block, since Jasmine 7 has no built-in `it.each` — use a `for...of` loop over a rows array, each calling `it(description, async () => {...})`:

- Full block A (currently L96-122, `'deletes only matching <id>-*/<id>_* files...'`): seeds 3 matching + 2 non-matching files, expects `` `Deleted:\n  .../first.md\n  .../second.md\n  .../third.md\nBRANCH=main\n` `` plus the remaining-files assertion.
- Light variant A (currently L124-136, `'returns "Deleted: (nothing to clean up)\n"...no files match'`): seeds 1 unrelated file, expects `'Deleted: (nothing to clean up)\nBRANCH=main\n'`.
- Light variant B (currently L138-145, `'...when the issues directory does not exist'`): no setup, expects the same `'Deleted: (nothing to clean up)\nBRANCH=main\n'`.
- Full block B (currently L172-186, inside `describe('full success path')`, `'resolves the Deleted: block immediately followed by BRANCH=<branch>\n'`): seeds 1 matching file, expects `` `Deleted:\n  ${ISSUES_DIR}/${ISSUE_ID}-split.md\nBRANCH=main\n` ``.

Table columns: `{ description, filesToSeed, expectedResult }` (plus whatever the "remaining files" assertion in full block A needs — either fold it into `expectedResult`'s row or keep it as an optional per-row assertion callback). Full block B lives inside a different `describe('full success path')` — decide whether to keep the loop scoped per-describe (2 rows there) or pull all 4 rows into one shared table at the top level; either is fine as long as `stubDeps()`/instance-construction stays identical to today and no coverage is lost.

Run `yarn test` (from `core/`) after this step — all `ArcanumSplitIssueFinish_spec.js` assertions must still pass with unchanged coverage. Then run `yarn lint` and `yarn duplication` (both from `core/`) across the whole family to confirm the lint stays clean and the duplication score has dropped.

## Files to Change

- `core/spec/lib/commands/arcanum-split-issue/ArcanumSplitIssueFinish_spec.js` — collapse the 4 assertion variants into one data-driven loop.
