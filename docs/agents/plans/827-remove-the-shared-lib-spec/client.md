# Client Plan: Remove the shared lib spec

Main plan: [plan.md](plan.md)

## Shared contracts

Point to `docs/agents/architecture/shared-lib.md#import-boundary` as a plain-text path. Change only the path; keep the rest of the wording and the rule as they are.

## Implementation Steps

### Step 1 — Repoint the two `no-restricted-imports` messages
In `cli/eslint.config.mjs`, the message for the `core/` pattern (line 104) and the message for the `shared/spec/` pattern (line 110) both say `docs/agents/specs/shared-lib.md`. Replace that with `docs/agents/architecture/shared-lib.md#import-boundary` in both. Keep the string concatenation style and re-split the literals if a line gets too long.

## Files to Change
- `cli/eslint.config.mjs` — two message strings, text only.

## CI Checks
- `cli`: `yarn lint` (CI job: `cli`)
