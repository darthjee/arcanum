# Shared Plan: Resolve config tiers from keys.json in the JS readers

Main plan: [plan.md](plan.md)

## Shared contracts

You produce:

- `KeyRegistry#allowsTier(key, tier)` returning `true | false | null` (`null` = no matching entry).
- `ConfigChain({ env, repoContext, registry = new KeyRegistry() })`. `read`/`readWithSource` skip a tier for a key when `allowsTier` returns `false`. `readTiers` entries gain `allowed` (present only when `allowsTier` returns a boolean), with values in disallowed tiers still reported.

## Steps

- [01 — Add KeyRegistry#allowsTier](shared/01-add-allows-tier.md)
- [02 — Filter tiers in ConfigChain](shared/02-filter-tiers-in-config-chain.md)
- [03 — Route RepoConfig through ConfigChain](shared/03-route-repo-config-through-config-chain.md)

## CI Checks

- `shared/`: `make shared-check` (CI jobs: `shared`, `shared-node-floor`)
- `cli/` bundles `shared/`: `make cli-check` (CI job: `cli`)
- `core/` imports `shared/`: `make core-check` (CI job: `test`, `checks`)

## Notes

- Precedence never follows the order in which `keys.json` lists tiers (`global, repo, local`). `allowsTier` only filters.
- `assertRegisteredConfigKey` keeps its strict-mode behavior, for specs only.
