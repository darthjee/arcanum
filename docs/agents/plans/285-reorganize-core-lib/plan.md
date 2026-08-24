# Plan: Reorganize core/lib/ into subfolders

Issue: [285-reorganize-core-lib.md](../issues/285-reorganize-core-lib.md)

## Overview

Split `core/lib/`'s 36 flat files into `commands/` (dispatch-table entrypoints) and domain-grouped `utils/` subfolders, mirror the structure in `core/spec/lib/`, and update every import/require path plus `core/bin/arcanum`'s `COMMANDS` registry. Entirely within `core/`'s Node.js source, so it has a single owner.

See [node.md](node.md) for the full plan.
