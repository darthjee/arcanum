# Plan: Phase 3: Remove repoPath from IssueStatePaths#paths()

Issue: [406-phase-3--remove-repopath-from-issuestatepaths-paths-.md](../issues/406-phase-3--remove-repopath-from-issuestatepaths-paths-.md)

## Overview

Completes the 3-phase `IssueStatePaths` migration (#397): drops the now-unused `repoPath`
parameter (and its Phase-1 fallback) from `paths()`, converges the constructor to a bare
required `repoContext` (matching `RepoConfig`/`QueueStore`'s finished shape), and updates
every call site and the spec accordingly.

See [node.md](node.md) for the full plan.
