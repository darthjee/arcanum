# Plan: Refactor IssueFile to take repoContext in its constructor

Issue: [402-refactor-issuefile-to-take-repocontext-in-its-constructor.md](../issues/402-refactor-issuefile-to-take-repocontext-in-its-constructor.md)

## Overview

Convert `core/lib/utils/file/IssueFile.js` from a static-only helper into an instantiable,
`repoContext`-bound class: both methods (`findExisting`, `titleFromFilename`) become
instance methods, the constructor takes `repoContext`, and `findExisting` stops taking
`repoPath` per call. The migration goes through a transitional dual-mode state (constructor
`repoContext` optional, `findExisting` still accepting an explicit `repoPath` with a
fallback) — mirroring the `GithubIssue.js` / `RepoConfig.js` precedent — before the
fallback and the `repoPath` parameter are removed. Finally the class is renamed away from
`IssueFile`, since it no longer represents a single file. All work is in `core/`, owned by
the `node` agent.

See [node.md](node.md) for the full plan.
