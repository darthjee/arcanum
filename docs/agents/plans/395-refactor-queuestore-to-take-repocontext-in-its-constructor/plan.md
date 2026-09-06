# Plan: Refactor QueueStore to take repoContext in its constructor

Issue: [395-refactor-queuestore-to-take-repocontext-in-its-constructor.md](../issues/395-refactor-queuestore-to-take-repocontext-in-its-constructor.md)

## Overview

`QueueStore` (`core/lib/utils/queue/QueueStore.js`) moves from taking `repoPath` as an
explicit argument on every public method to accepting an optional `repoContext` at
construction, mirroring the dual-mode precedent already shipped in
`core/lib/commands/shared/GithubIssue.js`. This is entirely within `core/`'s Node.js
source, so it's owned by a single agent.

See [node.md](node.md) for the full plan.
