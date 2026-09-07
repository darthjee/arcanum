# Plan: Decide and implement Origin's internal-use repoPath removal

Issue: [409-decide-and-implement-origin-s-internal-use-repopath-removal.md](../../issues/409-decide-and-implement-origin-s-internal-use-repopath-removal.md)

## Overview

`Origin` (`core/lib/utils/git/Origin.js`) gets an optional constructor-injected
`repoContext`, mirroring the `GithubToken`/`ConfigChain` precedent: `resolve`/
`resolveWithRef` keep `repoPath` as their first parameter but fall back to
`this._repoContext?.repoPath` when it's omitted. `RepoContext` moves `origin`'s
construction from a bare parameter default into a body-assigned, `??`-merged
self-bootstrap (`this._origin = origin ?? new Origin({ repoContext: this, execFileAsync });`),
matching how it already builds `githubToken`/`issueStateService`/
`githubIssueService`, and simplifies its own `resolve`/`resolveWithRef` wrappers to
call `this._origin` arg-free. `RepoContextFactory` drops its shared `origin`
instance entirely, the same way it already dropped `githubToken`/
`githubIssueService` — each per-call `RepoContext` self-bootstraps its own
`Origin` bound to itself instead.

See [node.md](node.md) for the full plan.
