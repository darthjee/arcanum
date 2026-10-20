# Registry validator spec and KeyRegistry spec

Add the specs from the spec's [Testing](../../../specs/arcanum-cli/key-registry.md#testing) section, mirroring `core/lib` 1:1.

**`KeyRegistry` behaviour.** Use small inline registries where needed, plus the real one:

- matching: exact beats wildcard, segment-count mismatch (`git.agents.foo.bar` → unknown), charset, single-segment `version`, namespace-only key (`git`) → unknown;
- one `check` case per reason: unknown, read-only, tier, type, enum, empty string (and `allow_empty`), `integer` / `min` / `max`, regex with element index in the result, `null`;
- `unset` stopping after the tier check.

**Registry validator, over the real `keys.json`.** It must pass. Each rule also gets a failing fixture fed to the validator helper:

- unknown entry fields;
- duplicate `key`;
- overlapping wildcards;
- prefix/leaf violations (`git.agents` alongside `git.agents.<agent>`);
- a `default` that doesn't match its type;
- `integer` / `min` / `max` on a non-number;
- `allow_empty` outside `string` / `enum`;
- an unknown `format`;
- `enum` without `values`, `array` without a scalar `items`;
- an empty or invalid `tiers`;
- `setup.section` outside `identity` / `engine` / `git` / `flow` / `ci`;
- `format_version` higher than 1.

## Files to Change
- `core/spec/lib/utils/config/KeyRegistry_spec.js` — new.
- `core/spec/lib/utils/config/keys_spec.js` (or a `describe` block inside `KeyRegistry_spec.js`) — validator over the real registry.
- `core/spec/support/fixtures/` — invalid-registry fixtures if inline objects get unwieldy.
