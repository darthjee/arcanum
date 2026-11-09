# Node Plan: Resolve config tiers from keys.json in the shell readers

Main plan: [plan.md](plan.md)

## Shared contracts

You test what the scripter produces, exactly as defined in [plan.md's Shared contracts](plan.md#shared-contracts):

- **`key_registry_allows_tier <full_key> <tier>`** prints `true`, `false` or `null` and always exits 0. `key_registry_has_key <full_key>` exits 0 or 1. Both read `KEY_REGISTRY_FILE`, which defaults to the installed `shared/lib/config/keys.json`.
- **`config_chain_read`** skips a key in a tier when `key_registry_allows_tier` prints `false`. Everything else is unchanged.
- **The readers moved onto the chain:**
  - `safe_branch_get`;
  - `wait_ci_shell.sh`;
  - the auto-fix-all / monitor-issues `config_get_shell.sh` and `config_is_enabled_shell.sh` (registered keys go through the chain, unregistered keys use the direct file read, then the legacy fallback).
- **The JS reference** is `KeyRegistry#allowsTier` / `#lookup` (`shared/lib/config/KeyRegistry.js`), `ConfigChain` and `NamespacedBooleanKeyConfig`, as merged in #902.

## Steps

- [01 — Unit and registry parity specs for key_registry.sh](node/01-key-registry-specs.md)
- [02 — Unit specs for config_chain_read's tier filter](node/02-config-chain-specs.md)
- [03 — Disallowed-tier fixtures in the shell-vs-native parity specs](node/03-resolution-parity-fixtures.md)

## CI Checks

- `core/`: `make core-check` (CI job runs `core-lint` + `core-test`).

## Notes

- **Running the shell side.** Follow `core/spec/bin/agentEmailParity_spec.js`: `execFile('bash', ['-c', 'cd "$1" && source "$2" && <fn> ...', ...])`, with fixture repos from `core/spec/support/utils/` (`createTempDir`, `createGitFixtureRepo`).
- **Isolating the global tier.** Set `CLAUDE_CONFIG_DIR` to a temp dir so the developer's real global config never leaks in.
- `ShellConfigKeyScan_spec.js` must keep passing unchanged. If it fails, the scripter's annotations are wrong; report that rather than exempting files.
