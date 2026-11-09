# Plan: Resolve config tiers from keys.json in the JS readers

Issue: [902-resolve-config-tiers-from-keys-json-in-the-js-readers.md](../../issues/902-resolve-config-tiers-from-keys-json-in-the-js-readers.md)

## Overview

Make `keys.json`'s `tiers` decide which tiers every JS config read consults. `KeyRegistry` gains a single `allowsTier(key, tier)` check. `ConfigChain` uses it to skip disallowed tiers on read and to flag them in `readTiers`. `RepoConfig` and `NamespacedBooleanKeyConfig`'s reads go through `ConfigChain` instead of hardcoded files. `/arcanum-check-config` and the CLI's `config get`/`list` show disallowed tiers as `ignored: tier not allowed`. Behavior for each key stays the same, because each key's declared tiers already match its reader.

## Agents involved

- [shared](shared.md): `KeyRegistry#allowsTier`, `ConfigChain` filtering, `RepoConfig` through `ConfigChain`.
- [node](node.md): `NamespacedBooleanKeyConfig` reads through `ConfigChain`, `/arcanum-check-config` marker, audit of the other `core/` callers.
- [client](client.md): CLI `config get` / `config list` filter and marker.
- [skill-writer](skill-writer.md): `/arcanum-check-config` report wording.

## Shared contracts

### `KeyRegistry#allowsTier(key, tier)` (shared produces; node and client consume)

- `key`: a concrete dotted key (e.g. `git.safe_branch`, `git.agents.node`), matched with the existing `lookup` (literal entry beats wildcard).
- `tier`: `'local' | 'repo' | 'global'`.
- Returns `true` if the matching entry's `tiers` includes `tier`, `false` if it doesn't, and **`null` when `lookup(key)` finds no entry** (an unknown key, or a non-leaf like `git.agents`).
- Callers treat `null` as "allowed" (fail-open): an unknown key reads every tier, as today.

### `ConfigChain` (shared produces; node consumes)

- Constructor: `new ConfigChain({ env, repoContext, registry })`, where `registry` defaults to `new KeyRegistry()`.
- `read` / `readWithSource`: same signatures and results. Within each tier (still local → repo → global), a key is tried only when `registry.allowsTier(`${namespace}.${key}`, tier) !== false`.
- `readTiers(repoPath, namespace, key)`: still one entry per tier, in precedence order, shadowed and disallowed tiers included. Each entry gains `allowed: boolean`, **present only when `allowsTier` returns a boolean**: `{ tier, file, set, value?, allowed? }`. The value of a disallowed tier is still reported (`set: true, value`).

### Display marker (node and client produce, skill-writer documents)

- The exact text is `ignored: tier not allowed`.
- `/arcanum-check-config` JSON: a disallowed tier's object gains `"allowed": false` and `"ignored": "tier not allowed"`. `final` is taken from the first tier with `set: true` and `allowed !== false`.
- CLI JSON output gains `allowed` on each tier entry (present only for known keys). The resolved value skips `allowed === false` tiers.

## Notes

- Docs, done by the architect while reviewing: update the key registry section of `docs/agents/architecture/shared-state-and-configuration.md` to say that `tiers` now drives JS reads, not only CLI writes. If #901's `docs/agents/architecture/config-keys.md` has merged by then, change its "Read via" notes for `git.safe_branch`, `auto-fix-all.ignored_check_patterns` and the namespaced booleans from "direct" to "chain (JS)".
- Out of scope: writes (#905), shell readers (#903), legacy fallbacks (#904), tier changes (#907), and the config doctor (#914).
