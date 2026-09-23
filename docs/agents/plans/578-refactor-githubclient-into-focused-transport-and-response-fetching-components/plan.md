# Plan: Refactor GitHubClient into focused transport and response-fetching components

Issue: [578-refactor-githubclient-into-focused-transport-and-response-fetching-components.md](../../issues/578-refactor-githubclient-into-focused-transport-and-response-fetching-components.md)

## Overview
Extract a single `GitHubTransport` (REST + GraphQL) with response-shape helpers, then rewrite `GitHubClient` and `IssueClient` as thin facades on top of it, making error mapping consistent across every non-best-effort method. All work is in `core/` and owned by the `node` agent.

See [node.md](node.md) for the full plan.
