# Client Plan: Remove the CLI install spec

Main plan: [plan.md](plan.md)

## Shared contracts

`docs/agents/specs/cli-install/self-update.md` is being deleted (by architect). Its content now lives in `docs/agents/architecture/arcanum-cli.md#self-update`.

## Implementation Steps

### Step 1 — Repoint the comment in `selfUpdate.js`

`cli/lib/commands/selfUpdate.js` lines 1–3 read:

```js
// `arcanum self-update`: updates the global arcanum-cli to the latest
// release (see docs/agents/specs/cli-install/self-update.md and
// docs/agents/architecture/arcanum-cli.md#self-update).
```

Drop the spec reference so it cites only `docs/agents/architecture/arcanum-cli.md#self-update`. Comment only; no code change. `make cli-check` (lint + specs) must still pass.

## Files to Change

- `cli/lib/commands/selfUpdate.js` — header comment only.

## CI Checks

- `cli/`: `make cli-check` (CI job: `cli`)
