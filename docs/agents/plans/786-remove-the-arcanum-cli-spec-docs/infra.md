# Infra Plan: Remove the arcanum CLI spec docs

Main plan: [plan.md](plan.md)

## Shared contracts

Use the mapping table in [plan.md → Shared contracts](plan.md#shared-contracts). Change comments only.

## Implementation Steps

### Step 1 — Repoint the publish script comment
`scripts/publish_cli_package.sh` (line 5): `docs/agents/specs/arcanum-cli/packaging-and-release.md#release` → `docs/agents/architecture/install-and-release.md#job-and-script`. That section documents this script's steps.

## Files to Change
- `scripts/publish_cli_package.sh`: header comment only

## Notes
- `.circleci/config.yml` already points at `docs/agents/architecture/install-and-release.md`, so it needs no change.
- `git grep -n "specs/arcanum-cli" -- scripts .circleci` must print nothing afterwards.
