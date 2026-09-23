# Plan: Reduce GitHubClient size by splitting responsibilities and extracting shared request helpers

Issue: [582-reduce-githubclient-size-by-splitting-responsibilities-and-extracting-shared-request-helpers.md](../../issues/582-reduce-githubclient-size-by-splitting-responsibilities-and-extracting-shared-request-helpers.md)

## Overview
Two phases in one PR. Phase 1 adds additive repo-scoped helpers (`repoRequest`/`repoRequestJson`/`repoRequestArray`) to `GitHubTransport` and migrates `IssueClient` onto them. Phase 2 splits `GitHubClient` into `GitHubPullRequestClient`, `GitHubPullRequestFeedbackClient`, `GitHubChecksClient` and `GitHubUserClient`, keeping `GitHubClient` as a thin delegating facade so no caller, bundle, or spec factory changes.

## Context
- #578 already moved request mechanics into `GitHubTransport`; what remains duplicated in both `GitHubClient` and `IssueClient` is the `repo()` → `failure` → `/repos/${repo}/...` preamble.
- Callers (`PrOperations`, `PrMonitor`, `MergeBodyResolver`, `AutoFixIssueGithub`, `AutoMonitorIssuePrResolvePrNumber`, `RepoContextFactory`) receive a single `githubClient` and mostly straddle concerns — hence the facade.
- Nothing outside `GitHubClient.js` touches its private members (`_transport`, `_defaultBranch`, `_mutateReaction`, `_git`), so they can move freely.
- `GitHubClient.prStateLabel` (static) is used by `PrOperations` and `PrMonitor` and must keep working.

## Steps

- [01 — Add repo-scoped helpers to GitHubTransport](node/01-transport-repo-scoped-helpers.md)
- [02 — Migrate IssueClient to the helpers](node/02-issueclient-adopt-helpers.md)
- [03 — Extract the four focused clients](node/03-extract-focused-clients.md)
- [04 — Turn GitHubClient into a delegating facade](node/04-githubclient-facade.md)

## CI Checks
- `core/`: `yarn test` (CI job: `test`)
- `core/`: `yarn lint` (CI job: `checks`)
- `core/`: `yarn duplication` (CI job: `checks`, non-blocking — but check the facade's one-line delegators and the moved specs don't introduce new clone groups; recent issues #552–#554 were dedicated to cleaning those up)

## Notes
- **Invariants (must hold after every step):** all 14 public `GitHubClient` methods keep identical names, arguments, return values, error messages and best-effort semantics; `new GitHubClient({ context, fetchFn, timeoutMs, git })` keeps its signature; HTTP and `resolveWithRef` call counts are unchanged; `GitHubClient.js` keeps its path and default export.
- Out of scope: restructuring `IssueClient` beyond adopting the helpers; changing existing `GitHubTransport` method signatures; rewording error messages or JSDoc (JSDoc moves with its method); migrating callers to the focused clients.
- `GitHubClientErrorMapping_spec.js` spans all clients, so keep it exercising the facade (end-to-end through `newGitHubClient`) rather than splitting it.
