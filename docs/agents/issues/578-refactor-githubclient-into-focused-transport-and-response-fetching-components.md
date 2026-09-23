# Issue: Refactor GitHubClient into focused transport and response-fetching components

## Description
`core/lib/utils/github/GitHubClient.js` (~579 lines) mixes repo/token resolution, URL building, auth headers, timeout signals, response validation, error translation, REST mutations, GraphQL mutations, and PR-specific operations in one class. Nearly every public method re-implements the same low-level request mechanics. `core/lib/utils/github/IssueClient.js` repeats the same mechanics for issue endpoints.

## Problem
Each method repeats the same steps: `this._context.resolveWithRef()` + `getToken()`, build a `https://api.github.com/repos/${repo}/...` URL, set `Authorization: Bearer` (plus `Content-Type` for mutations), attach `AbortSignal.timeout(this._timeoutMs)`, check `response.ok`, parse JSON, validate the shape, and throw a caller-specific error. Examples:

- `getPr`, `createPr`/`_defaultBranch`, `markPrReady`, and every `IssueClient` method wrap the fetch in `try/catch` and map every failure to one domain error.
- `getPrCommits`, `getPrReviews`, `getIssueComments`, `getPrReviewComments` are the same "GET array, `[]` on malformed" pattern with different paths and messages.
- `deleteBranch` and `_mutateReaction` are best-effort calls that swallow every failure.
- `markPrReady` and `_mutateReaction` duplicate the GraphQL POST setup.

The duplication has also caused error handling to drift. `getPr`/`createPr`/`markPrReady` turn a rejected fetch (network error, timeout) or unparseable JSON into their domain error. `getPrCommits`, `mergePr`, `getPrHeadSha`, `getCheckRuns`, `getCurrentUser`, `getPrState`, `getPrReviews`, `getIssueComments`, and `getPrReviewComments` let the raw `fetch`/`AbortSignal`/`SyntaxError` through.

## Expected Behavior
- Low-level GitHub connection mechanics live in one transport: API base URL, repo/token resolution, auth headers, JSON content type, timeout signal, and issuing REST and GraphQL requests.
- Reusable helpers cover the common response shapes: single JSON object, array (with `[]` normalization where it exists today), mutation (non-OK → error), and best-effort (swallow all failures).
- Error handling is consistent. Every non-best-effort method maps rejected fetches (network error, timeout), non-OK responses, and unparseable JSON to its own existing domain error message. Best-effort methods (`deleteBranch`, `addReaction`, `removeReaction`) still never throw.
- Apart from that change, every public `GitHubClient` and `IssueClient` method keeps its behavior: endpoint URLs, query params, payloads, timeout values, malformed-shape handling (`[]` normalization, `head.sha`/`check_runs`/`html_url`/`default_branch`/GraphQL `errors` checks), and error message text. The static `GitHubClient.prStateLabel` stays.
- `GitHubClient` stays a single thin facade (no split into several domain clients). The `RepoContext` scoping model and constructor dependency injection (`context`, `fetchFn`, `timeoutMs`, `git` / IssueClient's equivalents) stay the same, so callers and `RepoContextFactory` don't change.

## Solution
Owning agent: `node` (all changes are under `core/lib/` and `core/spec/`).

- Extract a transport class under `core/lib/utils/github/` taking `{ context, fetchFn, timeoutMs }`. It resolves repo and token, builds URLs from the API base, adds auth and content-type headers and the timeout signal, and issues requests. It also has a `graphql(query, variables)` method on the same transport, used by `markPrReady` and the reaction mutations.
- Add the response-shape helpers (single object / array / mutation / best-effort). Each takes a caller-supplied error factory so current messages are kept, and each maps rejected fetches and JSON parse failures through that factory too.
- Rewrite the `GitHubClient` methods and the `IssueClient` methods on top of these pieces. Work incrementally, keeping the existing specs green at each step, except for spec cases that assert the raw leaked errors. Update those cases to expect the domain error.
- Add unit specs for the new abstractions: successful responses, non-OK responses, rejected fetches, malformed JSON and shape handling, auth headers, GraphQL requests, and timeout configuration.
- Avoid an over-generic abstraction. Endpoint-specific behavior should stay readable in the domain methods.

### Caller impact of the error-consistency change (checked)
- `getPrState`, `getPrReviews`, `getIssueComments`, `getPrReviewComments` (via `PrMonitor`) and `getPrHeadSha`, `getCheckRuns` (via `PrOperations` → `PrChecker`) are all wrapped in `SafeFetcher.run`, which turns any error into `null`. No visible change.
- `getCurrentUser` is only called by `MergeBodyResolver#_resolveMergerLogin`, which catches everything and returns `''`. No visible change.
- `getPrCommits` (via `MergeBodyResolver#_coauthorsBody`) and `mergePr` (via `PrOperations#prMerge`) surface through `github.sh pr-merge` in `auto-fix-all`. On network, timeout, or bad-JSON failures the stderr message changes from a raw error (e.g. `fetch failed`) to the domain message (`could not fetch commits for pull request #N in <repo>` / `could not merge PR #N on <repo>`). The command still fails with a non-zero exit, and no skill parses this text, so no skill changes are needed.
- `IssueClient` already maps rejected fetches to its domain errors, so it has no caller-visible change beyond whatever JSON-parse handling becomes consistent.

## Benefits
- Much smaller `GitHubClient.js` and `IssueClient.js`, whose methods show only endpoint-specific behavior.
- Connection and error handling are defined once, so they can't drift again.
- Callers get predictable, domain-specific error messages instead of raw network or parse errors.
