# Add PrOperations.headSha() and checkRuns()

Add two thin delegation methods to `PrOperations`, mirroring how `prNumber()` delegates to `this._github.getPr(branch)`:

- `headSha(prNumber)` — `return this._github.getPrHeadSha(prNumber);`
- `checkRuns(sha)` — `return this._github.getCheckRuns(sha);`

No decision logic, no error handling beyond what `GitHubClient` already throws — `PrOperations` stays a pure REST-orchestration facade, keeping the layering violation (decision logic in `utils/`) from creeping back in, per the issue's "Alternatives considered".

## Files to Change

- `core/lib/utils/github/PrOperations.js` — add `headSha(prNumber)` and `checkRuns(sha)`.
- `core/spec/lib/utils/github/PrOperations_spec.js` — delegation tests: each method calls the corresponding `githubClient` method with the right argument and returns its result.
