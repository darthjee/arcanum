# Plan: Add list of entrypoints to be migrated

Issue: [230-add-list-of-entrypoints-to-be-migrated.md](../../issues/230-add-list-of-entrypoints-to-be-migrated.md)

## Overview
`arcanum/_lib/migration-status.json` only lists entrypoints already migrated to native (`true`). Add the ~43 remaining in-scope entrypoints (7 in `arcanum/_lib/*.sh`, ~36 across every skill's `<skill>/scripts/*.sh`) with `false`, then regenerate `docs/agents/architecture/entrypoint-migration-status.md` so the table reflects the full migration picture, not just what's done.

See [scripter.md](scripter.md) for the full plan.
