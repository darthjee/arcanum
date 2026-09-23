# Plan: Codacy: duplication cluster — autoFixAllQueueParity sibling specs (push/save/pop/empty/list/next/wait-next) (7 files)

Issue: [554-codacy-duplication-cluster-autofixallqueueparity-sibling-specs-push-save-pop-empty-list-next-6-files.md](../../issues/554-codacy-duplication-cluster-autofixallqueueparity-sibling-specs-push-save-pop-empty-list-next-6-files.md)

## Overview
Collapse the copy-pasted fixture/run/assert/cleanup scaffold in the seven `core/spec/bin/autoFixAllQueueParity/*_spec.js` files into one case-driven shared example, `itMatchesShellForQueueOp`, in `core/spec/support/sharedExamples/queueParitySharedExamples.js`. All work is in `core/spec/`, owned by the `node` agent.

See [node.md](node.md) for the full plan.
