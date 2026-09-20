# Refactor AutoFixIssueCommitChange_spec.js

Replace this spec's inline bootstrap with a call into `commitCommandFixtures.js`'s setup builder configured for the subcommand set that omits `add` (this command never stages), still with `fakeConfigChain`. Preserve this spec's extra top-level constants (`TYPE`/`SCOPE`/`SUBJECT`/`AGENT`) as local spec-file constants passed into the factory call, not folded into the shared helper. Replace the repeated commit-message assertion blocks with the shared assertion helper, passing this spec's own config inputs, template-fixture flag, and matcher.

Run `yarn test` (from `core/`) after this refactor to confirm no behavior or coverage was lost before moving to the last spec.

## Files to Change
- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueCommitChange_spec.js` — replace inline setup and repeated assertion blocks with `commitCommandFixtures.js` calls; no change to asserted behavior.
