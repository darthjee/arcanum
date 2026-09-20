# Refactor AutoPlanIssueCommitPlan_spec.js

This spec's setup block is byte-identical to `AutoNewIssueCommitIssue_spec.js`'s aside from the class name/path, so it uses the same `commitCommandFixtures.js` configuration (the `add`/`commit`/`branch`/`push` subcommand set, with `fakeConfigChain`). Replace the inline bootstrap and each repeated commit-message assertion block with calls into the new factory/helper, passing this spec's own per-scenario config inputs, template-fixture flag, and matcher.

Run `yarn test` (from `core/`) after this refactor to confirm no behavior or coverage was lost before moving to the next spec.

## Files to Change
- `core/spec/lib/commands/auto-plan-issue/AutoPlanIssueCommitPlan_spec.js` — replace inline setup and repeated assertion blocks with `commitCommandFixtures.js` calls; no change to asserted behavior.
