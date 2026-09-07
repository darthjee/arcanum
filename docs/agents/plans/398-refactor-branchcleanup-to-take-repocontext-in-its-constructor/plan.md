# Plan: Refactor BranchCleanup to take repoContext in its constructor

Issue: [398-refactor-branchcleanup-to-take-repocontext-in-its-constructor.md](../../issues/398-refactor-branchcleanup-to-take-repocontext-in-its-constructor.md)

## Overview

Migrate `core/lib/utils/git/BranchCleanup.js` from a per-call `repoPath`
argument to a constructor-injected `repoContext`, in three
backward-compatible phases — each landing as its own PR that keeps
`make core-test` / `make core-lint` green on its own. The final
constructor shape is `constructor(repoContext, { execFileAsync } = {})`,
matching `core/lib/commands/shared/GithubIssue.js`.

See [node.md](node.md) for the full plan.
