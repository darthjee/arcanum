# Plan: Split spec dispatcher

Issue: [367-split-spec-dispatcher.md](../../issues/367-split-spec-dispatcher.md)

## Overview

Spec-only reorganization of `core/spec/lib/core/dispatcher_spec.js` (276 lines, 8 flat
top-level `describe`s) into four concern-scoped sibling files under `core/spec/lib/core/`.
Every `it` moves verbatim; `core/lib/core/dispatcher.js` and all other production code are
untouched. All work is inside `core/spec/`, so `node` is the sole owner.

See [node.md](node.md) for the full plan.
