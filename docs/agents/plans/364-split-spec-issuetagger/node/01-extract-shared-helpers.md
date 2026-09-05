# Extract shared spec helpers into a factory module

Create `core/spec/support/factories/issueTagger.js` exporting the two helpers currently
defined in `core/spec/lib/utils/issue/IssueTagger_spec.js`: the module-level
`fakeIssueClient(opts)` (lines 20–40) and the local `newTagger(opts)` currently nested inside
the top-level `describe` (lines 43–51). Copy both bodies verbatim as named exports. `newTagger`
keeps importing `createRepoContextMock` from the existing
`core/spec/support/factories/repoContextFactory.js` and constructing `new IssueTagger({
context, issueClient })` exactly as today — only its location changes, not its behavior or
signature. Also export the `REPO` constant (`'darthjee/arcanum'`) the two helpers close over,
since all three future spec files need the same value for their assertions. Leave
`IssueTagger_spec.js` itself untouched in this step — steps 02–04 remove its use of these
inline helpers as each new file lands.

## Files to Change

- `core/spec/support/factories/issueTagger.js` — new file, exports `REPO`, `fakeIssueClient`,
  and `newTagger`, copied verbatim from `IssueTagger_spec.js` lines 6–51 (constant + both
  helpers), with `newTagger` importing `IssueTagger` and `createRepoContextMock` directly.
