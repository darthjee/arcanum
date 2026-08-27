# Plan: Refactor AutoFixAllGithub to extract responsibilities

Issue: [304-refactor-autofixallgithub-to-extract-responsibilities.md](../issues/304-refactor-autofixallgithub-to-extract-responsibilities.md)

## Overview

`AutoFixAllGithub` (`core/lib/commands/AutoFixAllGithub.js`) is a `github.sh`
facade that still carries an inline `_mutateTag` decision tree, two nearly
identical per-call `RepoContext` builders, and a 9-collaborator constructor.
This plan extracts a `RepoContextFactory` (`core/lib/context/`) that assembles
the `RepoContext` plus every context-bound client, extracts a strict
`TagMutationService` (`core/lib/services/`) that owns the tag-mutation logic
with its exact throw-based error contract preserved, and collapses the command
constructor to three defaulting collaborators — all with byte-identical
`github.sh` stdout/exit-code parity.

All work is within the **node** agent's scope (`core/lib/`, `core/spec/`).

See [node.md](node.md) for the full plan.
