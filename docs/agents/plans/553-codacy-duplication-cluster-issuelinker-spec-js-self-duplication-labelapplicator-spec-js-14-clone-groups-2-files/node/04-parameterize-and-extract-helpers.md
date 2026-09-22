# Parameterize IssueLinker's link-failure tests and extract arrange/act helpers
**Parameterize.** In `IssueLinker_spec.js`, replace these three tests with a single table-driven test:
- "node id missing" (`{ nodeIds: {} }`)
- "node-id lookup throws" (`{ nodeIdFail: true }`)
- "GraphQL mutation fails" (`{ graphqlFail: true, nodeIds: { 1: 'PARENT_NODE_ID', 42: 'NEW_NODE_ID' } }`)

Each row is `{ description, fakeOptions, expectsMutation }`. Every row asserts the `Warning: could not link issue #42 as a native sub-issue of #1 — created but not linked; link it manually on GitHub\n` stderr write. Rows with `expectsMutation: false` (the two node-id cases) also assert `execFileAsync` was not called with `api`. Jasmine has no `it.each`, so use `[...].forEach(... => it(...))` inside a `describe('--as-subissue link failure fallback')`.

**Extract arrange/act helpers.** Add a small per-file helper in each spec, e.g. `async function runLink(fakeOptions, asSubissue)` in `IssueLinker_spec.js` and `async function runApply(fakeOptions)` in `LabelApplicator_spec.js`. Each helper builds the fake, constructs the collaborator, spies on `process.stderr.write`, runs the call and returns `execFileAsync`. The remaining tests in both files use it, keeping their assertions unchanged.

Finally, run `yarn test`, `yarn lint` and `yarn duplication` in `core/` and confirm no clone groups remain for these files.

## Files to Change
- `core/spec/lib/utils/issue/IssueLinker_spec.js` — table-driven link-failure test and a `runLink` helper.
- `core/spec/lib/utils/issue/LabelApplicator_spec.js` — `runApply` helper.
