# Plan: Refactor AutoFixAllQueue

Issue: [253-refactor-autofixallqueue.md](../issues/253-refactor-autofixallqueue.md)

## Overview
`core/lib/AutoFixAllQueue.js` currently mixes queue CRUD, queue file I/O, and GitHub label mutation in one 488-line class. This plan extracts the file I/O into a new `QueueStore.js` and the label mutation into a new generic `IssueTagger.js`, both injected into `AutoFixAllQueue`'s constructor, with no change to its public API or observable stdout/stderr output.

See [node.md](node.md) for the full plan.
