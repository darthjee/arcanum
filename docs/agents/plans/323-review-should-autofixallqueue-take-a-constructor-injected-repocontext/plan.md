# Plan: Review: should AutoFixAllQueue take a constructor-injected RepoContext?

Issue: [323-review-should-autofixallqueue-take-a-constructor-injected-repocontext.md](../../issues/323-review-should-autofixallqueue-take-a-constructor-injected-repocontext.md)

## Overview

Migrate `AutoFixAllQueue` to the constructor-injected `RepoContext` shape already
used by `AutoFixAllGithub`: the seven `auto-fix-all-queue-*` registry entries
gain `context: 'repo'`, the class takes `constructor(repoContext, { ...deps })`,
methods drop their leading `repoPath`, and `save` / `push` reuse the injected
context (via a `RepoContextFactory` bundle) instead of building a `RepoContext`
by hand. All work is in `core/` — owned by the `node` agent.

See [node.md](node.md) for the full plan.
