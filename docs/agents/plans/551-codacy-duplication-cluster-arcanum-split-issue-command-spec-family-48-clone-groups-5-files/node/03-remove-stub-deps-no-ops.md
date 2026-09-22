# Remove the no-op stubDeps passthroughs

Both `stubDeps(overrides = {}) { return { ...overrides }; }` helpers are pure passthroughs that add no behavior beyond documentation:

- `ArcanumSplitIssueCreateSubIssueFile_spec.js`: called 17 times, always as `stubDeps()` with no arguments. Delete the helper and replace every `stubDeps()` call site with `{}` (or whatever the constructor's default-deps argument already resolves to when omitted — confirm which reads cleaner without changing behavior).
- `IssueState_spec.js`: called 8 times as `stubDeps()`, plus once (L94) as `stubDeps({ issueStatePaths: { paths: pathsSpy } })`. Delete the helper, replace the 8 no-arg call sites with `{}`, and replace the one real-override call site directly with `{ issueStatePaths: { paths: pathsSpy } }` (no wrapper).

Run `yarn test` (from `core/`) after this step — both specs must still pass with unchanged coverage and identical assertions.

## Files to Change

- `core/spec/lib/commands/arcanum-split-issue/ArcanumSplitIssueCreateSubIssueFile_spec.js` — remove `stubDeps`, inline `{}` at all 17 call sites.
- `core/spec/lib/commands/shared/IssueState_spec.js` — remove `stubDeps`, inline `{}` at the 8 no-arg call sites and the real override at the one call site that needs it.
