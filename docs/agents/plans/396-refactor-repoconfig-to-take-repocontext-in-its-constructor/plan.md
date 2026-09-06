# Plan: Refactor RepoConfig to take repoContext in its constructor

Issue: [396-refactor-repoconfig-to-take-repocontext-in-its-constructor.md](../issues/396-refactor-repoconfig-to-take-repocontext-in-its-constructor.md)

## Overview

`RepoConfig` (`core/lib/utils/config/RepoConfig.js`) moves from taking `repoPath` as an
explicit argument on every public method to accepting an optional `repoContext` at
construction, mirroring the dual-mode precedent already shipped in
`core/lib/commands/shared/GithubIssue.js`. This is entirely within `core/`'s Node.js
source, so it's owned by a single agent.

See [node.md](node.md) for the full plan.
