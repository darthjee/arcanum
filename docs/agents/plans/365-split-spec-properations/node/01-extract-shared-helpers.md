# Extract shared spec helpers into a factory module

Create `core/spec/support/factories/prOperations.js` holding named-export copies of the three
local helpers currently defined in `PrOperations_spec.js`: `fakeGit`, `fakeGithubClient`, and
`newPrOperations` (plus the `REPO` constant they close over). Copy the bodies and JSDoc
verbatim — no behavior change. `newPrOperations` keeps composing `createRepoContextMock` from
the existing `core/spec/support/factories/repoContextFactory.js` (import it as a sibling,
`./repoContextFactory.js`), and constructs `PrOperations` via `import PrOperations from
'../../../lib/utils/github/PrOperations.js'`. Follow the export style of the sibling
`core/spec/support/factories/autoFixAllWaitCi.js` (named exports, no default export, no
barrel/index file).

`PrOperations_spec.js` itself is **not** touched in this step — it keeps its own local copies
of the helpers until step 04 deletes the whole file. This step only adds the new module so
steps 02–04 have something to import from.

## Files to Change

- `core/spec/support/factories/prOperations.js` — new file; `REPO`, `fakeGit`,
  `fakeGithubClient`, and `newPrOperations`, copied verbatim from `PrOperations_spec.js`
  (core/spec/lib/utils/github/PrOperations_spec.js:1-74) as named exports.
