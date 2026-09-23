# Plan: Reduce GitHubClient size by splitting responsibilities and extracting shared request helpers

Issue: [582-reduce-githubclient-size-by-splitting-responsibilities-and-extracting-shared-request-helpers.md](../../issues/582-reduce-githubclient-size-by-splitting-responsibilities-and-extracting-shared-request-helpers.md)

## Overview
Add repo-scoped request helpers to `GitHubTransport` (adopted by `IssueClient` and the new clients), then split `GitHubClient` into four focused clients behind a thin delegating facade — a pure internal refactor of `core/` with no public API, error-message, or behavior changes.

See [node.md](node.md) for the full plan.
