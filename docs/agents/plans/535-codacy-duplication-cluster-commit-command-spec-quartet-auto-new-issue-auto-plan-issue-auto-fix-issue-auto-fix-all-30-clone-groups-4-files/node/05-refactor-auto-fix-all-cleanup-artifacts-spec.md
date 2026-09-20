# Refactor AutoFixAllCleanupArtifacts_spec.js (setup factory only)

This spec diverges the most from the other three: it fakes `ls-files`/`rm`/`diff` instead of `add`, has no `fakeConfigChain` at all (the command always hardcodes the `"architect"` agent), and its `beforeEach`/`afterEach` build a `PLAN_DIR` fixture rather than `filePath`/`planDir`. Replace its inline bootstrap with a call into `commitCommandFixtures.js`'s setup builder, configured for this subcommand set and with `configChain` omitted/disabled.

Do **not** apply the repeated-assertion helper here — this spec has only one commit-message assertion block (single-scenario, hardcoded message), so introducing the helper would add indirection without removing any duplication. Leave that one assertion inline.

Run `yarn test` (from `core/`) to confirm no behavior or coverage was lost, then run `yarn lint` and `yarn duplication` (both from `core/`) across all four refactored specs to confirm the Codacy duplication score dropped as expected.

## Files to Change
- `core/spec/lib/commands/auto-fix-all/AutoFixAllCleanupArtifacts_spec.js` — replace inline setup with the `commitCommandFixtures.js` call (subcommand set: `ls-files`/`rm`/`diff`/`commit`/`branch`/`push`, no `configChain`); leave its single commit-assertion block inline; no change to asserted behavior.
