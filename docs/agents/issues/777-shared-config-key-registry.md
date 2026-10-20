# Issue: Shared config key registry

## Description

Part of epic #767 (Arcanum user-facing CLI for configuration).

Implement the shared, machine-readable registry of known arcanum config keys exactly as decided in [`docs/agents/specs/arcanum-cli/key-registry.md`](../specs/arcanum-cli/key-registry.md). The spec settles every design point (entry shape, location, wildcard matching, validation, sync enforcement, seed list); this issue transcribes it into code with no further design decisions.

## Problem

Arcanum config keys are read in many places (shell `config_chain_read` / `repo_config_*` / `global_config_*`, Node `ConfigChain` / `RepoConfig`), but there is no single list of which keys exist, their types, allowed tiers or defaults. The upcoming `arcanum-cli` needs that list to validate writes and drive `list`, `--help`, the setup wizard and the shortcuts, and nothing prevents a new key from being added without being documented.

## Expected Behavior

- `core/lib/utils/config/keys.json` exists as `{"format_version": 1, "keys": [...]}` with an entry for every seed key, each with `type` (and `values` / `items` / `format` / number constraints / `allow_empty` where relevant), `tiers`, `read_only`, `default`, `description`, and `setup` on the wizard keys.
- `core/lib/utils/config/KeyRegistry.js` loads it through a static JSON import and exposes `lookup(key)` and `check(op, key, tier, value)`, which returns a structured result rather than throwing.
- Any core spec that reads an unregistered key fails, and so does any shell script that does. Every registry default is checked against the default the code actually applies.
- Production behaviour of skills is unchanged; nothing consumes the registry at runtime.

## Solution

All of the following follow the spec. Owner: `node` for the code and specs, `architect` for the docs rule.

1. **Registry file**: `core/lib/utils/config/keys.json`, with the closed type vocabulary (`string`, `boolean`, `number`, `enum` + `values`, `array` + `items`), the optional `format` (`regex` only), `read_only`, `default`, `integer` / `min` / `max`, `allow_empty` and `setup: {section, order, prompt, instances?}`. Entries are an array, and unknown fields are rejected.
2. **Seed list**: transcribe the spec's final seed table, including descriptions and the `setup` assignments (sections `identity`, `engine`, `git`, `flow`, `ci`). **Leave out `monitor-issues.clear_context`**: #776 adds that entry when it moves the setting into the tier files. If #776 has already merged when this lands, add the entry here instead, or the sync specs will flag it as an unregistered key.
3. **`KeyRegistry.js`**: loader, matcher and validator.
   - Matching: a `<name>` segment matches exactly one segment, concrete segments match `[A-Za-z0-9_-]+`, and an exact entry beats a wildcard.
   - Checks run in a fixed order: known key → read-only → tier → value (type, enum, format, range, empty string, `null`). `unset` stops after the tier check.
   - Regex failures name the element index.
   - It uses a static `import keys from './keys.json' with { type: 'json' }`. Verify that unbundled Node 22.13 prints no `ExperimentalWarning`; if it does, fall back to `keys.js` with `export default [...]`.
4. **Shared surface**: add `keys.json` and `KeyRegistry.js` to the explicit shared-surface allowlist in `core/eslint.config.mjs` that #778 introduces.
5. **Sync enforcement** (all three layers):
   - a defaults drift spec: Node defaults are exported as constants and compared, and shell defaults are checked by running the helper with no config present;
   - an `ARCANUM_STRICT_CONFIG_KEYS=1` guard in `ConfigChain#read` and in `RepoConfig`'s read, which throws on an unregistered key. Core's spec runner sets the variable;
   - a shell static scan spec under `core/spec/` over `*.sh` calls to `config_chain_read` / `repo_config_read|write` / `global_config_read|write`. A `${var}` segment counts as a wildcard, and a call whose key can't be parsed needs a `# config-key: <key>` annotation.
6. **Docs rule**: add the checklist item "adding a config key means adding a `keys.json` entry" to `docs/agents/architecture/shared-state-and-configuration.md` and to the `node` and `scripter` agent docs.
7. **Specs**:
   - a `KeyRegistry` spec covering matching and one `check` case per failure reason;
   - a registry validator spec over the real `keys.json`: unknown fields, duplicates, overlapping wildcards, prefix/leaf violations, a default that doesn't match its type, field-scope rules, the `format` vocabulary and `setup.section`;
   - the sync specs above.

### Dependencies

- **After #778** (the shared-surface allowlist must exist).
- Independent of #776.
- Before #779 (`cli/` scaffold).

## Benefits

- One source of truth for config keys, shared by arcanum's docs and code and bundled into `arcanum-cli`.
- Typos and wrong types are caught at write time by the CLI rather than later, when a skill reads the key.
- CI enforces that every key arcanum reads is registered and that the registry's defaults match the code.
