# Shared Plan: Remove the shared lib spec

Main plan: [plan.md](plan.md)

## Shared contracts

The ESLint comment points to `docs/agents/architecture/shared-lib.md#import-boundary` as a plain-text path. The README uses a markdown link to the doc, without an anchor.

## Implementation Steps

### Step 1 — Repoint the import-boundary comment
In `shared/eslint.config.mjs`, the comment "The import boundary (see docs/agents/specs/shared-lib.md)" (line 54) changes to `docs/agents/architecture/shared-lib.md#import-boundary`. Rewrap the comment if the line gets too long.

### Step 2 — Repoint the README link
In `shared/README.md`, line 8, change "The design lives in the [Shared Lib spec](../docs/agents/specs/shared-lib.md)." to "The design lives in [Shared Lib](../docs/agents/architecture/shared-lib.md)."

## Files to Change
- `shared/eslint.config.mjs` — one comment, text only.
- `shared/README.md` — one link.

## CI Checks
- `shared`: `yarn lint` (CI job: `shared`)
