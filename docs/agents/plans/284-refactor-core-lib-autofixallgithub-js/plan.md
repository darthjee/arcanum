# Plan: Refactor core/lib/AutoFixAllGithub.js

Issue: [284-refactor-core-lib-autofixallgithub-js.md](../../issues/284-refactor-core-lib-autofixallgithub-js.md)

## Overview

Shrink `core/lib/commands/AutoFixAllGithub.js` from 784 lines down to a thin, ~100-line facade by delegating its duplicated tag/label logic to `IssueTagger`, extracting its GitHub PR/branch-lifecycle logic to a new `PrOperations.js`, and extracting its local-git `cleanup-branch` logic to a new `BranchCleanup.js` — with byte-identical output preserved across all 7 subcommands.

See [node.md](node.md) for the full plan.
