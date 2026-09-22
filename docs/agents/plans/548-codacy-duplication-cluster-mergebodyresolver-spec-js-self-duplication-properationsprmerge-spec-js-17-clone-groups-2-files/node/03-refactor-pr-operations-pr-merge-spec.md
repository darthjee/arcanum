# Refactor PrOperationsPrMerge_spec.js to use the shared example

In `core/spec/lib/utils/github/PrOperationsPrMerge_spec.js`, replace the duplicated merge-body-resolution scenarios (the `omits commit_message entirely in "full" mode` / `sends an empty commit_message in "empty" mode` `it`s, and the entire `describe('"coauthors" mode', ...)` block's 2 `it`s) with a call to `registerMergeBodyResolverSharedExamples`, passing a callback that:

1. Builds a `prOperations`/`githubClient` pair via the file's existing `newPrOperations({ pull: PULL, commits, configValues, user })` factory.
2. Calls `await prOperations.prMerge()`.
3. Reads `githubClient.mergePr.calls.mostRecent().args[1]` and maps it to `{ included: 'commit_message' in args, body: args.commit_message ?? '' }`, so the shared example's `{ included, body }` assertions apply unmodified.

Keep the non-merge-body-resolution scenarios untouched: "merges with an empty body by default...", "uses the cached pr_id/pr_url...", "rejects with the merge-failure error...", "deletes the branch ref...", "never calls context.getToken()...".

Import `registerMergeBodyResolverSharedExamples` from `../../../support/sharedExamples/mergeBodyResolverSharedExamples.js`.

## Files to Change

- `core/spec/lib/utils/github/PrOperationsPrMerge_spec.js` — replace duplicated `empty`/`full`/`coauthors` mode assertion blocks with `registerMergeBodyResolverSharedExamples(...)`; keep the integration-only scenarios listed above.
