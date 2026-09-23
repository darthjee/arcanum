# Plan: Refactor GitHubClient into focused transport and response-fetching components

Issue: [578-refactor-githubclient-into-focused-transport-and-response-fetching-components.md](../../issues/578-refactor-githubclient-into-focused-transport-and-response-fetching-components.md)

## Overview
Introduce `core/lib/utils/github/GitHubTransport.js`, which owns every low-level GitHub request mechanic: API base URL, token resolution, auth and content-type headers, timeout signal, GraphQL POST, and the mapping of rejected fetches, non-OK responses, and unparseable JSON to a caller-supplied error. Then rewrite `GitHubClient` and `IssueClient` so each method only states its endpoint path, payload, operation-specific validation, and error message.

## Context
- `GitHubClient.js` (579 lines) and `IssueClient.js` (196 lines) repeat `resolveWithRef()` + `getToken()` + URL + `Authorization: Bearer` + `AbortSignal.timeout` + ok-check + JSON parse in every method.
- Error handling has drifted. `getPr`, `createPr`, `markPrReady`, and the `IssueClient` methods map a rejected fetch to their domain error. `getPrCommits`, `mergePr`, `getPrHeadSha`, `getCheckRuns`, `getCurrentUser`, `getPrState`, `getPrReviews`, `getIssueComments`, `getPrReviewComments` (and `IssueClient#getIssue`/`#createIssue` for bad JSON) let raw errors through.
- Decisions made in the issue discussion:
  - `IssueClient` is migrated in the same issue.
  - GraphQL uses the same transport.
  - Error handling is made consistent everywhere.
  - `GitHubClient` stays a single facade.
  - Constructors (`{ context, fetchFn, timeoutMs, git }`) and `RepoContextFactory` wiring stay the same.
- Caller impact was checked. `PrMonitor`/`PrChecker` wrap calls in `SafeFetcher`, and `MergeBodyResolver#_resolveMergerLogin` catches everything. The only visible change is the stderr text of `github.sh pr-merge` on network, timeout, or bad-JSON failures, which still exits non-zero and which no skill parses.

## Steps

- [01 — Add GitHubTransport](node/01-add-github-transport.md)
- [02 — Migrate GitHubClient read methods](node/02-migrate-githubclient-reads.md)
- [03 — Migrate GitHubClient mutations and GraphQL](node/03-migrate-githubclient-mutations-graphql.md)
- [04 — Migrate IssueClient](node/04-migrate-issueclient.md)

## CI Checks
- `core`: `make core-test` (CI job: `test`, runs `yarn test`)
- `core`: `make core-lint` (CI job: `checks`, runs `yarn lint`; `yarn duplication` is non-blocking there but should not grow)

## Notes
- Keep every endpoint URL, query string (`per_page=100`, `state=all`, `encodeURIComponent` usage), payload, and error message text byte-for-byte. Existing specs assert them.
- Keep the abstraction small. Don't add a generic "endpoint descriptor" layer. Operation-specific validation (`pull.number`, `head.sha`, `check_runs`, `html_url`, `default_branch`, GraphQL `errors`) stays visible in the domain methods.
- Keep `GitHubClient.prStateLabel` static and unchanged.
- The `_mutateReaction` JSDoc says `markPrReady` is "the one GraphQL call". Update such stale comments where methods are rewritten.
