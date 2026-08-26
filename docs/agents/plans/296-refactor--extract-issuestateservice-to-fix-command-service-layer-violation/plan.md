# Plan: Refactor: Extract IssueStateService to fix command→service layer violation

Issue: [296-refactor--extract-issuestateservice-to-fix-command-service-layer-violation.md](../../issues/296-refactor--extract-issuestateservice-to-fix-command-service-layer-violation.md)

## Overview

Extract the CRUD logic currently living in the `IssueState` command class into a new `IssueStateService` (plus 4 supporting utility classes), so `RepoContext`/`PrOperations` stop depending on a CLI entrypoint class — establishing `commands → context/services → utils` as a strictly one-way dependency graph.

See [node.md](node.md) for the full plan.
