# Plan: Migrate the auto-fix-all lifecycle commands to RepoContext

Issue: [311-migrate-the-auto-fix-all-lifecycle-commands-to-repocontext.md](../../issues/311-migrate-the-auto-fix-all-lifecycle-commands-to-repocontext.md)

## Overview

Sub-issue 3 of #308: migrate the five `auto-fix-all` lifecycle commands to
constructor-injected `RepoContext`, flipping `takesRepoContext: true` in
`core/lib/core/commands.js` per command and reading `repoPath` off
`this._repoContext.repoPath`. Also extends `RepoContextFactory` with a
build-from-`RepoContext` path so `AutoFixAllWaitCi`'s `PrOperations`/`PrChecker`
run on the injected context. Every file touched is under `core/`.

See [node.md](node.md) for the full plan.
