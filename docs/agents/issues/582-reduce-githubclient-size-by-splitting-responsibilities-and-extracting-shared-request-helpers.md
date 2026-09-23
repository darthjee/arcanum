# Issue: Reduce GitHubClient size by splitting responsibilities and extracting shared request helpers

## Description

`GitHubClient` (`core/lib/utils/github/GitHubClient.js`) currently owns several unrelated GitHub concerns: PR lookup/state, PR lifecycle actions, review/comment fetching, reaction mutations, check-run queries, and user lookup. #578 already moved request mechanics (URL building, token, timeout, JSON parsing, failure mapping) into `GitHubTransport`, but the client itself still mixes concerns, and a repo-scoped preamble is still duplicated across nearly every method of both `GitHubClient` and `IssueClient`:

```js
const { repo } = await this._transport.repo();
const failure = () => new Error(`... ${repo}`);
return this._transport.requestArray(`/repos/${repo}/...`, { failure });
```

This is a pure internal refactor: no behavior, error message, or public API changes.

## Problem

- `GitHubClient` mixes PR lifecycle, PR feedback, checks, and user concerns in one class, making it harder to reason about and to test in isolation.
- The `repo()` → `failure` → `/repos/${repo}/...` preamble is repeated in 9 of the 13 repo-scoped methods across `GitHubClient` and `IssueClient`.

## Expected Behavior

- `GitHubClient` becomes a thin delegating facade over four focused clients; it no longer implements unrelated responsibilities itself.
- Repo-scoped request boilerplate is centralized in additive `GitHubTransport` helpers, used by both the new clients and `IssueClient`.
- No caller, `RepoContextFactory` bundle, or spec-factory changes are required:
  - `new GitHubClient({ context, fetchFn, timeoutMs, git })` keeps its signature.
  - `GitHubClient.prStateLabel` keeps working (static delegating to the PR client).
  - All 14 public methods keep identical names, arguments, return values, error messages, and best-effort semantics (`deleteBranch`, `addReaction`, `removeReaction` never throw).
  - HTTP and `resolveWithRef` call counts are unchanged.
- `GitHubClient.js` keeps its path and default export; each new client lives in its own file under `core/lib/utils/github/` with a default export.
- All existing tests (including caller and parity specs) keep passing.

## Solution

Two phases, in this order, in a single PR.

### Phase 1 — Repo-scoped helpers on `GitHubTransport`

Add `repoRequest`, `repoRequestJson` and `repoRequestArray`, each taking a path builder and a failure-message builder that receive the full resolved identity (`{ repo, repoRef, ... }`), plus the usual `method`/`body` options:

```js
transport.repoRequestArray(
  ({ repo }) => `/repos/${repo}/pulls/${n}/commits?per_page=100`,
  ({ repo }) => `could not fetch commits for pull request #${n} in ${repo}`
);
```

Contract:

- Call `repo()` first and let its rejection propagate **unmapped** (matches today: `origin` resolution errors reach the caller as-is).
- Build `failure = () => new Error(messageFn(ids))` lazily and pass it to the existing `request`/`requestJson`/`requestArray`; the message builder is not invoked on success.
- Existing transport methods keep their signatures and behavior (additive change only).

**Usage rule:** use a repo-scoped helper when the only repo-dependent parts of a method are its path and failure message. Methods with post-response validation keep calling `repo()` once plus the base transport methods explicitly: `getPr` (empty result → `failure()`), `getPrHeadSha` (missing `head.sha`), `getCheckRuns` (malformed `check_runs`), `createPr` (default-branch lookup + POST + `html_url` check). Non-repo-scoped calls — `getCurrentUser` (`/user`), `markPrReady` and the reaction mutations (GraphQL) — keep using `requestJson`/`graphql` directly.

Migrate `IssueClient`'s 5 methods to the helpers too (no other `IssueClient` restructuring).

### Phase 2 — Split `GitHubClient`

| Client | Members |
|---|---|
| `GitHubPullRequestClient` (receives `git`, needed only by `createPr`) | `getPr`, `getPrState`, `getPrHeadSha`, `getPrCommits`, static `prStateLabel`, `createPr` (+ private `_defaultBranch`), `mergePr`, `markPrReady`, `deleteBranch` |
| `GitHubPullRequestFeedbackClient` | `getPrReviews`, `getIssueComments`, `getPrReviewComments`, `addReaction`, `removeReaction` (+ private `_mutateReaction`) |
| `GitHubChecksClient` | `getCheckRuns` |
| `GitHubUserClient` | `getCurrentUser` |

`GitHubClient` builds one shared `GitHubTransport` (safe: it holds only `context`/`fetchFn`/`timeoutMs`), passes it to the four clients (forwarding `git` to the PR client), and delegates each public method with a one-liner. Full JSDoc moves with each method to its focused client; facade methods carry short docs pointing at them. `deleteBranch` keeps wrapping the whole helper call — including repo resolution — in `bestEffort(...)`.

### Decisions and rejected alternatives

- **Helpers on the transport, not a shared base class** for the focused clients — `IssueClient` repeats the same preamble, so the transport is the one place both families can share it without inheritance.
- **Plain delegating facade**, not direct injection of the focused clients (most callers straddle concerns — `PrOperations`: PR + checks; `MergeBodyResolver`: PR + user; `PrMonitor`: feedback + PR state — so that would be a broad rewrite) and not facade-exposed getters (two ways to call the same thing, no consumer). Moving a caller to a narrower client can be a later, separate issue.
- **`getPrState`/`prStateLabel` go to the PR client** (they describe PR state and hit the same endpoint as `getPrHeadSha`), even though `PrMonitor` is their main consumer.
- **No further query/lifecycle split** of the PR client — with the helpers most methods are 1–3 lines.
- **Single-method clients stay separate** (`GitHubChecksClient`, `GitHubUserClient`) rather than a vague catch-all; `deleteBranch` stays in the PR client (post-merge step) rather than a one-method refs client.
- **A `then: (body, ids) => result` hook** on the helpers was rejected in favor of plain validation code; resolving `repo()` twice is not acceptable (it would change `resolveWithRef` call counts).
- **Naming** keeps the `GitHub…` prefix, consistent with `GitHubClient`/`GitHubTransport`.

### Out of scope

- Splitting or otherwise restructuring `IssueClient` (beyond adopting the helpers).
- Changing any existing `GitHubTransport` method's signature or behavior.
- Changing any error message text; JSDoc moves rather than being rewritten.
- Migrating callers to the focused clients.

### Testing

- `GitHubTransport_spec.js`: new cases for the three helpers — builders receive the resolved identity, request failures map to the built message, repo-resolution rejections propagate unmapped, the message builder is not invoked on success.
- `IssueClient` specs pass unchanged.
- The existing `GitHubClient*_spec.js` files (grouped by concern since #580) move to per-client spec files (`GitHubPullRequestClient*_spec.js`, `GitHubPullRequestFeedbackClient_spec.js`, `GitHubChecksClient_spec.js`, `GitHubUserClient_spec.js`) with identical assertions and messages; a small factory mirroring `newGitHubClient` builds each client.
- A lightweight `GitHubClient_spec.js` verifies each public method (and static `prStateLabel`) delegates to the right focused client and that the constructor forwards `git`/`fetchFn`/`timeoutMs`.
- All caller and parity specs (`PrOperations`, `PrMonitor`, `MergeBodyResolver`, `AutoFixIssueGithub`, …) pass unchanged.

### Other considerations

- Performance & security: N/A — same requests, same call counts.
- Migration: none — internal to `core/`.
- No new root-level folder.

## Benefits

- Each GitHub concern (PR lifecycle, PR feedback, checks, user) is owned by one small, focused class that can be tested in isolation.
- Repo-scoped request boilerplate lives in one place, shared by `GitHubClient`'s clients and `IssueClient`.
- Zero churn for callers: the public API, error messages, and behavior are preserved.
- Future changes to PR lifecycle vs. feedback vs. checks become easier to reason about.
