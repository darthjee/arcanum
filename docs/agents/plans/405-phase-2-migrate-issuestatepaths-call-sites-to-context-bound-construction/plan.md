# Plan: Phase 2: Migrate IssueStatePaths call sites to context-bound construction

Issue: [405-phase-2-migrate-issuestatepaths-call-sites-to-context-bound-construction.md](../../issues/405-phase-2-migrate-issuestatepaths-call-sites-to-context-bound-construction.md)

## Overview

Rewire the three `IssueStatePaths` callers so each constructs the collaborator with a
context (`new IssueStatePaths({ repoContext })`, the options-bag constructor added by
Phase 1 / #404) and stops passing a real `repoPath` into `paths()` — calling
`paths(undefined, id)` and leaning on the Phase-1 fallback. `IssueStateService` and
`IssueState` bind to the context they already hold; `GithubIssue` is special-cased because
its per-call `IssueStateService` is built from a *per-call* `RepoContext`, not from
`this._repoContext` (which is `undefined` on the `fetch` path).

See [node.md](node.md) for the full plan.
