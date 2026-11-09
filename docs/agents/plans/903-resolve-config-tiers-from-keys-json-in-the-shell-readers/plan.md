# Plan: Resolve config tiers from keys.json in the shell readers

Issue: [903-resolve-config-tiers-from-keys-json-in-the-shell-readers.md](../../issues/903-resolve-config-tiers-from-keys-json-in-the-shell-readers.md)

## Overview

Shell config reads skip any tier that `shared/lib/config/keys.json` doesn't allow for the key, matching JS since #902 (PR #915).

- The scripter adds a jq-based `arcanum/_lib/key_registry.sh` that mirrors `KeyRegistry#lookup` / `#allowsTier`.
- `config_chain_read` filters its tiers with it.
- `safe_branch_get`, `wait_ci_shell.sh` and the auto-fix-all / monitor-issues boolean readers move onto the chain.
- The node agent covers it with unit specs and shell-vs-native parity specs.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

### `arcanum/_lib/key_registry.sh` (sourced, never executed)

- **Guard.** It guards against double-sourcing (`_LIB_KEY_REGISTRY_LOADED`).
- **Registry file.** `KEY_REGISTRY_FILE` is the path of the registry it reads. If unset or empty when a function runs, it defaults to `<dir of key_registry.sh>/../../shared/lib/config/keys.json`. Specs set `KEY_REGISTRY_FILE` to a fixture path before calling.
- **`key_registry_allows_tier <full_key> <tier>`** prints exactly one line, `true`, `false` or `null`, and always exits 0:
  - `null` when:
    - the key is malformed, meaning any dot segment fails `^[A-Za-z0-9_-]+$`, or the key is empty;
    - no entry matches;
    - the registry file is missing, unreadable, invalid JSON, or has no `keys` array;
    - `<tier>` is not one of `local`, `repo` or `global`.
  - Matching: a literal entry (`entry.key == full_key`) beats a wildcard one. Otherwise the first entry in registry order wins whose key has the same segment count and whose every segment is either equal or a wildcard `^<[A-Za-z0-9_-]+>$`. This is identical to `KeyRegistry#lookup` in `shared/lib/config/KeyRegistry.js`.
  - Otherwise it prints `true` when the entry's `tiers` includes `<tier>`, and `false` when it doesn't.
- **`key_registry_has_key <full_key>`** exits 0 when an entry matches under the same rules, and 1 otherwise (including a missing or broken registry). It prints nothing. It mirrors `Boolean(KeyRegistry#lookup(key))`.
- **bash 3.2.** No associative arrays, no `mapfile`, no `${var,,}`. All matching is done in jq.

### `config_chain_read <repo_path> <namespace> <key1> [<key2> ...]` (changed)

- **Tier skip.** Same tier order and key loop as today, but before reading `<namespace>.<key>` in a tier (`local`, `repo`, `global`) it calls `key_registry_allows_tier`. When that prints `false`, it skips that key in that tier without reading the file. `true` and `null` both read as before.
- **Values.** `null` values still fall through, `""` still stops the chain, it always exits 0, and the output keeps the same shape (`jq -c`).

### Readers moved onto the chain

- **`safe_branch_get`**: `config_chain_read "." git safe_branch`, quotes stripped, empty means `origin/main` (same output as today).
- **`auto-fix-all/scripts/wait_ci_shell.sh`**: `config_chain_read "." auto-fix-all ignored_check_patterns`, empty means `[]` (no legacy fallback, same as today).
- **Boolean readers** (`config_get_shell.sh` / `config_is_enabled_shell.sh` in `auto-fix-all/scripts` and `monitor-issues/scripts`) mirror `NamespacedBooleanKeyConfig#_readValue` / `#_readNewValue` (`core/lib/utils/config/NamespacedBooleanKeyConfig.js`):
  1. If `key_registry_has_key "<namespace>.<key>"`: `value=$(config_chain_read "." "<namespace>" "<key>")`. A registered key set to `null` resolves to empty here.
  2. Otherwise: today's direct presence-checked read of `_new_file_for_key` (so `null` prints `null`, as in JS).
  3. If `value` is still empty: the legacy file from `_legacy_file_for_key`, flat key, with the same "config has moved" stderr warning (`repo_config_read "" "<legacy>" ...`).
  4. The callers' defaults are unchanged: get prints `false` for empty, and is_enabled succeeds only on `true`.

## Notes

- **Architect (after the agents finish):** update `docs/agents/architecture/config-keys.md` and `docs/agents/architecture/shared-state-and-configuration.md`:
  - they now say shell reads are filtered by `tiers` too;
  - remove the "shell readers don't consult the registry yet (#903)" wording;
  - the `direct` shell rows become `chain`;
  - mention `key_registry.sh` next to `KeyRegistry#allowsTier`.
- **Writers** (`config_toggle_shell.sh`, `config_set_shell.sh`) are out of scope (#905). Leave their file selection untouched, including the toggle's read-before-flip.
