# Plan: Refactor ConfigChain to take repoContext in its constructor

Issue: [401-refactor-configchain-to-take-repocontext-in-its-constructor.md](../issues/401-refactor-configchain-to-take-repocontext-in-its-constructor.md)

## Overview

Extend `ConfigChain`'s constructor to optionally accept a `repoContext`, with `read()`
falling back to `repoContext.repoPath` when `repoPath` isn't passed per call — mirroring
the dual-mode precedent in `GithubIssue.js` — while keeping `RepoContext.js`'s existing
zero-arg internal construction of `ConfigChain` working unchanged.

See [node.md](node.md) for the full plan.
