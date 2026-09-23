# Issue: Split GitHubClient_spec.js into smaller domain-focused spec files

## Description
`core/spec/lib/utils/github/GitHubClient_spec.js` is 616 lines. It has 17 top-level `describe` blocks covering every public `GitHubClient` method, plus a table-driven "failed-request error mapping on read methods" block. It is hard to navigate, and a change to one method means reading a very large file.

## Problem
- A single file covers unrelated areas: PR lookup/state, PR creation, other PR mutations, review/comment feedback, reactions, check runs, the current user, and cross-cutting error mapping.
- The `newClient(fetchFn, git)` helper is defined inline, so no other spec file can reuse it.
- Sibling classes already follow a split pattern (`PrOperationsPrMerge_spec.js`, `PrOperationsPrNumber_spec.js`, `PrOperationsQueries_spec.js`, backed by `spec/support/factories/prOperations.js`), and `GitHubClient_spec.js` doesn't.

## Expected Behavior
- The spec is split by domain into several files under `core/spec/lib/utils/github/`. Each top-level `describe` block is 15–74 lines today, so the proposed grouping (approximate current lines per group, before imports and header) is:
  - `GitHubClientPrQueries_spec.js` (~150): `#getPr`, `#getPrState`, `.prStateLabel`, `#getPrHeadSha`, `#getPrCommits`
  - `GitHubClientCreatePr_spec.js` (~100): `#createPr`, `#createPr failed-request mapping`
  - `GitHubClientPrMutations_spec.js` (~115): `#mergePr`, `#markPrReady`, `#deleteBranch`
  - `GitHubClientPrFeedback_spec.js` (~145): `#getPrReviews`, `#getIssueComments`, `#getPrReviewComments`, `#addReaction / #removeReaction`
  - `GitHubClientChecks_spec.js` (~60): `#getCheckRuns`, `#getCurrentUser`
  - `GitHubClientErrorMapping_spec.js` (~40): the table-driven "failed-request error mapping on read methods" cases

  `#createPr` gets its own file because keeping it with the other mutations (~215 lines) would go over the size target.
- The shared client builder moves to `core/spec/support/factories/githubClient.js`. It exports something like `newGitHubClient(fetchFn, git)` plus the `REPO`/`TOKEN` constants, and it is built on `createRepoContextMock` from `repoContextFactory.js`, the same way `prOperations.js` is.
- The original `GitHubClient_spec.js` is deleted.
- No new spec file goes over ~200 lines.
- No coverage is lost:
  - The file declares 51 `it(...)` cases today. The table-driven block expands 2 of them over 9 methods, so jasmine runs more specs than that.
  - Record the total spec count jasmine reports before the change. It must be the same after the change.
  - Every assertion is kept.
- This is a pure move/regroup. No behavior changes and no production-code changes.

## Solution
Owning agent: `node` (only `core/spec/` changes).

1. Record the current jasmine spec count (`npm test` in `core/`).
2. Create `core/spec/support/factories/githubClient.js` with the extracted `newClient` logic and the constants.
3. Move each `describe` block into its domain file. Change nothing except the imports and the helper name.
4. Delete `GitHubClient_spec.js`.
5. Verify:
   - The jasmine spec count matches step 1.
   - Lint passes.
   - Each new file is at most ~200 lines.

## Benefits
- Smaller, focused spec files that are easier to navigate and review.
- A reusable `GitHubClient` spec factory, consistent with the `PrOperations` spec layout.
