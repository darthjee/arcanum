# Refactor MergeBodyResolver_spec.js to use the shared example

In `core/spec/lib/utils/github/MergeBodyResolver_spec.js`, replace the duplicated `#buildBody` scenarios (the `empty`/`full` mode `it`s at the top of `describe('#buildBody', ...)`, plus the entire `describe('"coauthors" mode', ...)` block's 8 `it`s) with a call to `registerMergeBodyResolverSharedExamples`, passing a callback that:

1. Builds a resolver via the file's existing `newResolver({ configValues, githubClient: { getPrCommits: jasmine.createSpy().and.resolveTo(commits), ...overrides } })` helper (reuse `coauthorsResolver`'s config-merging behavior where it maps directly).
2. Calls `await resolver.buildBody(7, modelEmail)`.
3. Returns the result directly (already `{ included, body }` — no mapping needed).

Keep `newResolver` and `coauthorsResolver` (or fold `coauthorsResolver` into the callback if it no longer has other callers) since Step 1's shared example needs a way to construct commits/config per scenario. Keep the `#resolveMode` describe block untouched — it's unrelated to this duplication.

Import `registerMergeBodyResolverSharedExamples` from `../../../support/sharedExamples/mergeBodyResolverSharedExamples.js`.

## Files to Change

- `core/spec/lib/utils/github/MergeBodyResolver_spec.js` — replace duplicated `empty`/`full`/`coauthors` mode assertion blocks with `registerMergeBodyResolverSharedExamples(...)`; keep `#resolveMode` and the resolver-construction helpers.
