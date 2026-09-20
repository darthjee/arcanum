# Refactor AutoNewIssueCommitIssue_spec.js

Replace this file's inline repo/git-mock bootstrap (~lines 1-68) with a call into the new `commitCommandFixtures.js` setup builder, configured for the `add`/`commit`/`branch`/`push` subcommand set and a `fakeConfigChain`. Replace each of the repeated ~7-8 line commit-message assertion blocks (5-6 occurrences per scenario) with a call to the new assertion helper, passing the varying config inputs, template-fixture flag, and matcher for that scenario.

Run `yarn test` (from `core/`) after this refactor to confirm no behavior or coverage was lost before moving to the next spec.

## Files to Change
- `core/spec/lib/commands/auto-new-issue/AutoNewIssueCommitIssue_spec.js` — replace inline setup and repeated assertion blocks with `commitCommandFixtures.js` calls; no change to asserted behavior.
