# Architect Plan: Remove the shared lib spec

Main plan: [plan.md](plan.md)

## Shared contracts

None to produce. Run the final grep (see [plan.md](plan.md) Notes) only after `node`, `client` and `shared` are done. If one of them was blocked, make that edit yourself first, as described in that agent's plan file.

## Implementation Steps

### Step 1 — Delete the spec and its index row
Delete `docs/agents/specs/shared-lib.md`. There is no `docs/agents/specs/shared-lib/` folder. In `docs/agents/specs.md`, remove the `Shared Lib` row from the table, following that index's rule that a removed spec loses its entry.

### Step 2 — Final check
Run `grep -rn 'specs/shared-lib' --exclude-dir=node_modules --exclude-dir=.git .` from the repo root. Every match must be under `docs/agents/issues/` or `docs/agents/plans/`. Fix any other match.

## Files to Change
- `docs/agents/specs/shared-lib.md` — deleted.
- `docs/agents/specs.md` — remove the `Shared Lib` row.
