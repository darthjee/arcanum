# Plan: Split spec SpawnIssue

Issue: [369-split-spec-spawnissue.md](../../issues/369-split-spec-spawnissue.md)

## Overview

Spec-only reorganization of `core/spec/lib/commands/shared/SpawnIssue_spec.js` (268 lines,
one top-level `describe('#run')` with 5 nested scenario `describe`s) into 3 flat sibling spec
files grouped by scenario, backed by one new shared factory module so the inline
`stubDeps`/`buildContext` helpers and constants are written once instead of duplicated across
all three files.

See [node.md](node.md) for the full plan.
