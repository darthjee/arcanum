# Plan: Migrate SpawnIssue and AutoFixAllGithub to constructor-injected RepoContext

Issue: [312-migrate-spawnissue-and-autofixallgithub-to-constructor-injected-repocontext.md](../../issues/312-migrate-spawnissue-and-autofixallgithub-to-constructor-injected-repocontext.md)

## Overview

Final GitHub-facing slice of #308: flip `takesRepoContext: true` on the `spawn-issue`
and all seven `auto-fix-all-github-*` command registry entries so the `Dispatcher`
builds and injects the `RepoContext`, then rewrite `SpawnIssue` and `AutoFixAllGithub`
to `constructor(repoContext, { ...injectables })`, dropping the leading `repoPath`
parameter from every method and deleting their internal per-call context builders.
The two non-CLI callers (`ArcanumSplitIssueCreateSubIssue`, `AutoFixAllWaitCiAndMerge`)
are updated to forward their own `repoContext`.

See [node.md](node.md) for the full plan.
