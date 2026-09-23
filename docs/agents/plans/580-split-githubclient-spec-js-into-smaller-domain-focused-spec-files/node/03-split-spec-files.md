# Move describe blocks into domain spec files
Create these files under `core/spec/lib/utils/github/`. Each one imports `newGitHubClient` (and `REPO`/`TOKEN` where the moved blocks use them) from `../../../support/factories/githubClient.js`, wraps its blocks in `describe('GitHubClient', ...)`, and renames `newClient(` to `newGitHubClient(`. Nothing else changes.

| File | Blocks (current lines) |
| --- | --- |
| `GitHubClientPrQueries_spec.js` | `#getPr` (43), `#getPrState` (25), `.prStateLabel` (15), `#getPrHeadSha` (34), `#getPrCommits` (32) |
| `GitHubClientCreatePr_spec.js` | `#createPr` (74, including its local `fakeGit`), `#createPr failed-request mapping` (27) |
| `GitHubClientPrMutations_spec.js` | `#mergePr` (35), `#markPrReady` (49), `#deleteBranch` (29) |
| `GitHubClientPrFeedback_spec.js` | `#getPrReviews`, `#getIssueComments`, `#getPrReviewComments` (32 each), `#addReaction / #removeReaction` (47) |
| `GitHubClientChecks_spec.js` | `#getCheckRuns` (34), `#getCurrentUser` (23) |
| `GitHubClientErrorMapping_spec.js` | `failed-request error mapping on read methods` (37) |

`.prStateLabel` is static, so its file also imports `GitHubClient` itself.

## Files to Change
- `core/spec/lib/utils/github/GitHubClientPrQueries_spec.js`: new
- `core/spec/lib/utils/github/GitHubClientCreatePr_spec.js`: new
- `core/spec/lib/utils/github/GitHubClientPrMutations_spec.js`: new
- `core/spec/lib/utils/github/GitHubClientPrFeedback_spec.js`: new
- `core/spec/lib/utils/github/GitHubClientChecks_spec.js`: new
- `core/spec/lib/utils/github/GitHubClientErrorMapping_spec.js`: new
