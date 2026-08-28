# Plan: Migrate AutoFixAllWaitCi._prOperations to RepoContextFactory

Issue: [305-migrate-autofixallwaitci-properations-to-repocontextfactory.md](../../issues/305-migrate-autofixallwaitci-properations-to-repocontextfactory.md)

## Overview

Swap `AutoFixAllWaitCi`'s hand-rolled `_prOperations(repoPath)` context
assembly for the shared `RepoContextFactory`, adopting the same
injected-`repoContextFactory` constructor shape `AutoFixAllGithub` took in
#306. Pure internal wiring change — no behavior change, parity with
`wait_ci.sh` preserved.

See [node.md](node.md) for the full plan.
