# Plan: Split spec AutoFixAllQueue

Issue: [360-split-spec-autofixallqueue.md](../issues/360-split-spec-autofixallqueue.md)

## Overview

Spec-only reorganization of `core/spec/lib/commands/auto-fix-all/AutoFixAllQueue_spec.js`
(385 lines, all 7 public methods of `AutoFixAllQueue` plus a lock-contention block) into four
flat sibling spec files, with its three local test helpers lifted into a new shared support
factory. No production code changes.

See [node.md](node.md) for the full plan.
