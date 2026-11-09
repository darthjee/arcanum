# Scripter Plan: Resolve config tiers from keys.json in the shell readers

Main plan: [plan.md](plan.md)

## Shared contracts

You produce everything in [plan.md's Shared contracts](plan.md#shared-contracts):

- `arcanum/_lib/key_registry.sh` (`KEY_REGISTRY_FILE`, `key_registry_allows_tier`, `key_registry_has_key`);
- the tier skip in `config_chain_read`;
- the three reader migrations.

The node agent's specs test against these exact names, outputs and exit codes.

## Steps

- [01 — Add key_registry.sh](scripter/01-add-key-registry.md)
- [02 — Filter tiers in config_chain_read](scripter/02-filter-tiers-in-config-chain.md)
- [03 — Route safe_branch_get and wait_ci_shell.sh through the chain](scripter/03-route-direct-readers-through-chain.md)
- [04 — Route the boolean config readers through the chain](scripter/04-route-boolean-readers-through-chain.md)

## CI Checks

- `core/`: `make core-check` (the shell libraries are exercised by `core/spec`, including `ShellConfigKeyScan_spec.js`).

## Notes

- Everything under `arcanum/_lib` must run on macOS `/bin/bash` 3.2. CI runs bash 5, so it won't catch 3.2 problems.
- Engine dispatch runs native code under `env -i`, and shell scripts inside Docker see the whole install. `KEY_REGISTRY_FILE` is never set there, so the default path must resolve through `BASH_SOURCE`, not cwd.
