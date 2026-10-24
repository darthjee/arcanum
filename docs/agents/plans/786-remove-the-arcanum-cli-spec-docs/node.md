# Node Plan: Remove the arcanum CLI spec docs

Main plan: [plan.md](plan.md)

## Shared contracts

Use the mapping table in [plan.md → Shared contracts](plan.md#shared-contracts). Change comments only, with no spec expectation changes.

## Implementation Steps

### Step 1 — Repoint the core/spec comments
Each of these cites `specs/arcanum-cli/key-registry.md` and a named section ("Enforcing 'a new key means a registry entry'", or "How arcanum's own code consumes the registry"). Both now live in `docs/agents/architecture/shared-state-and-configuration.md#keeping-it-in-sync`. Point the comment there and drop the old spec section name.
- `core/spec/support/utils/shellConfigKeys.js` (line 2)
- `core/spec/lib/utils/config/ShellConfigKeyScan_spec.js` (line 10)
- `core/spec/lib/utils/config/KeyRegistryDefaults_spec.js` (line 15). Keep the `issue #777` mention.

## Files to Change
- the three files above: comments only

## CI Checks
- `core`: `yarn lint && yarn test` (CI jobs: `test`, `checks`)

## Notes
- `git grep -n "specs/arcanum-cli" -- core` must print nothing afterwards.
