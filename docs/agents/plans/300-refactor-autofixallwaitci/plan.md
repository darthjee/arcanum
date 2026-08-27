# Plan: Refactor AutoFixAllWaitCi

Issue: [300-refactor-autofixallwaitci.md](../issues/300-refactor-autofixallwaitci.md)

## Overview

Extract `AutoFixAllWaitCi`'s GitHub REST calls, PR-number resolution, and poll decision tree into the appropriate layers (`GitHubClient`, `PrOperations`, a new `PrChecker` service, and a new `SafeFetcher` utility), leaving the command as a thin entrypoint orchestrator — mirroring the `PrOperations` (#292) and `IssueStateService` (#296/#297) precedents.

See [node.md](node.md) for the full plan.
