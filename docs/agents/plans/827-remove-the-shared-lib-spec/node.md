# Node Plan: Remove the shared lib spec

Main plan: [plan.md](plan.md)

## Shared contracts

Point to `docs/agents/architecture/shared-lib.md#import-boundary` as a plain-text path. Change only the path; keep the rest of the wording and the rule as they are.

## Implementation Steps

### Step 1 — Repoint the `SHARED_SPEC_BAN` comment and message
In `core/eslint.config.mjs`, the comment above `SHARED_SPEC_BAN` (line 7) and its `message` (line 11) both say `docs/agents/specs/shared-lib.md`. Replace that with `docs/agents/architecture/shared-lib.md#import-boundary` in both places. Rewrap the comment if the line gets too long.

## Files to Change
- `core/eslint.config.mjs` — two path references, text only.

## CI Checks
- `core`: `yarn lint` (CI job: `checks`)
