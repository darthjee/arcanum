# Plan: Refactor PrOperations

Issue: [294-refactor-properations.md](../issues/294-refactor-properations.md)

## Overview

Push infrastructure-concern resolution (tokens, repo paths, repo refs) out of `PrOperations` and into its collaborators (`GitClient`, `GitHubClient`, `MergeBodyResolver`), all bound to a single `RepoContext` at construction, and add a new `Git`/`GitBranch` pair to deduplicate `issue-<id>` branch parsing. Purely internal, single-agent work — everything lives under `core/lib/`/`core/spec/`.

See [node.md](node.md) for the full plan.
