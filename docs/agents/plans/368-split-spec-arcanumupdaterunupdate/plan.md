# Plan: Split spec ArcanumUpdateRunUpdate

Issue: [368-split-spec-arcanumupdaterunupdate.md](../../issues/368-split-spec-arcanumupdaterunupdate.md)

## Overview

Spec-only reorganization of `core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdate_spec.js`
(270 lines, 2 top-level `describe` blocks) into two flat sibling spec files split by method
(`#check`, `#apply`), backed by one new shared factory module so the ~115 lines of inline
fakes/constants are written once instead of duplicated across both files.

See [node.md](node.md) for the full plan.
