# Extract the four focused clients

Create four new classes under `core/lib/utils/github/`, each with a default export and a constructor taking `{ transport }` (plus `git` for the PR client). No shared base class. Move each method's body **and its full JSDoc** verbatim from `GitHubClient.js`, then switch the qualifying methods to the repo-scoped helpers from step 01.

| File | Members | Helper usage |
|---|---|---|
| `GitHubPullRequestClient.js` (`{ transport, git }`) | `getPr`, `getPrState`, `getPrHeadSha`, `getPrCommits`, static `prStateLabel`, `createPr`, private `_defaultBranch`, `mergePr`, `markPrReady`, `deleteBranch` | helpers: `getPrState`, `getPrCommits`, `mergePr`, `deleteBranch`. Explicit `repo()` + base methods (post-response validation): `getPr`, `getPrHeadSha`, `createPr`/`_defaultBranch`. `markPrReady` stays on `graphql`. |
| `GitHubPullRequestFeedbackClient.js` (`{ transport }`) | `getPrReviews`, `getIssueComments`, `getPrReviewComments`, `addReaction`, `removeReaction`, private `_mutateReaction` | helpers: the three `get*`. Reactions stay on `graphql` + `bestEffort`. |
| `GitHubChecksClient.js` (`{ transport }`) | `getCheckRuns` | explicit (validates `check_runs`). |
| `GitHubUserClient.js` (`{ transport }`) | `getCurrentUser` | `requestJson('/user', ...)` — not repo-scoped. |

Constraints:
- `deleteBranch` must keep wrapping the **whole** helper call (including repo resolution) in `this._transport.bestEffort(...)`.
- Each method resolves `repo()` exactly once (never call `repo()` and then a helper).
- Error messages byte-for-byte identical; `getPr` still uses `repoRef` in its message and derives `owner` from `repo`.
- Class-level JSDoc per client describing its concern; reuse the relevant parts of `GitHubClient`'s current class JSDoc.

Specs: move the existing concern-grouped specs to per-client files, keeping assertions and messages identical, backed by a new factory in `core/spec/support/factories/` that mirrors `newGitHubClient` (same `REPO`/`TOKEN`, `createRepoContextMock`, `timeoutMs: 5`) but builds a transport and a focused client — e.g. `newGitHubTransport(fetchFn)` plus small per-client builders, or one generic `newFocusedClient(ClientClass, fetchFn, extraDeps)`. Mapping:
- `GitHubClientPrQueries_spec.js` → `GitHubPullRequestClientQueries_spec.js` (incl. `.prStateLabel`)
- `GitHubClientPrMutations_spec.js` → `GitHubPullRequestClientMutations_spec.js`
- `GitHubClientCreatePr_spec.js` → `GitHubPullRequestClientCreatePr_spec.js`
- `GitHubClientPrFeedback_spec.js` → `GitHubPullRequestFeedbackClient_spec.js`
- `GitHubClientChecks_spec.js` → split into `GitHubChecksClient_spec.js` (`#getCheckRuns`) and `GitHubUserClient_spec.js` (`#getCurrentUser`)
- `GitHubClientErrorMapping_spec.js` stays as-is (facade-level, see step 04).

Use `git mv` for the renames so history follows the specs.

## Files to Change
- `core/lib/utils/github/GitHubPullRequestClient.js` — new.
- `core/lib/utils/github/GitHubPullRequestFeedbackClient.js` — new.
- `core/lib/utils/github/GitHubChecksClient.js` — new.
- `core/lib/utils/github/GitHubUserClient.js` — new.
- `core/spec/support/factories/` — new factory for building a transport-backed focused client (e.g. extend `githubClient.js` or add `githubFocusedClients.js`).
- `core/spec/lib/utils/github/GitHubClient{PrQueries,PrMutations,CreatePr,PrFeedback,Checks}_spec.js` — moved/renamed to the per-client spec files listed above.
