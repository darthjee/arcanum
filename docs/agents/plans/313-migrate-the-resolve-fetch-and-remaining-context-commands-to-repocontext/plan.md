# Plan: Migrate the resolve/fetch and remaining context commands to RepoContext

Issue: [313-migrate-the-resolve-fetch-and-remaining-context-commands-to-repocontext.md](../../issues/313-migrate-the-resolve-fetch-and-remaining-context-commands-to-repocontext.md)

## Overview

Sub-issue 5 of #308 — the final per-command batch. Seven `core/bin/arcanum`
commands move from a leading `repoPath` positional method argument to a
constructor-injected `RepoContext` supplied by the `Dispatcher`. This is
entirely `core/` Node.js work, so the whole plan is owned by the `node` agent.

See [node.md](node.md) for the full plan.
