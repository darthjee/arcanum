# Shared Plan: Remove the arcanum CLI spec docs

Main plan: [plan.md](plan.md)

## Shared contracts

Use the mapping table in [plan.md → Shared contracts](plan.md#shared-contracts). Change comments only.

## Implementation Steps

### Step 1 — Repoint the shared/lib comments
- `shared/lib/config/KeyRegistry.js` (line 30): `specs/arcanum-cli/key-registry.md` → `docs/agents/architecture/shared-state-and-configuration.md#the-key-registry`
- `shared/lib/config/AgentEmail.js` (line 13): `specs/arcanum-cli/shared-config-logic.md` → `docs/agents/architecture/shared-lib.md#configchainreadwithsource-and-agentemail`. Check the anchor against the heading "### `ConfigChain#readWithSource` and `AgentEmail`".

## Files to Change
- `shared/lib/config/KeyRegistry.js`: comment only
- `shared/lib/config/AgentEmail.js`: comment only

## CI Checks
- `shared`: `yarn lint && yarn test` (CI jobs: `shared`, `shared-node-floor`)

## Notes
- `git grep -n "specs/arcanum-cli" -- shared` must print nothing afterwards.
