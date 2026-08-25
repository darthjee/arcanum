# Plan: reduce size of PrOperations

Issue: [292-reduce-size-of-properations.md](../issues/292-reduce-size-of-properations.md)

## Overview

Extract `core/lib/utils/github/PrOperations.js` (a 509-line God Object mixing git CLI operations, GitHub REST lookups, merge-body/co-authors logic, PR mutations, and PR state derivation) into 4 new classes — `RepoContext`, `GitClient`, `GitHubClient`, `MergeBodyResolver` — and refactor `PrOperations` into a thin per-call facade; `AutoFixAllGithub` is adjusted to create `RepoContext` per-call. Entirely within `core/`'s Node.js source, so it has a single owner.

See [node.md](node.md) for the full plan.
