# Unit and registry parity specs for key_registry.sh

Add `core/spec/bin/sharedLibKeyRegistry_spec.js`.

**Unit cases**, using a fixture registry written to a temp file and passed through `KEY_REGISTRY_FILE`:

- **exact entry:** `true` for a listed tier, `false` for an unlisted one;
- **wildcard entry** (`a.<x>.c`): a concrete key matches; a different segment count doesn't (`null`);
- **exact over pattern:** with both `a.<x>` (tiers `[global]`) and `a.b` (tiers `[local]`), `a.b` + `local` gives `true` and `a.b` + `global` gives `false`;
- **first wildcard in registry order wins** when two wildcard entries match;
- **unknown key, non-leaf key, malformed key** (`a..b`, `a.b c`, `""`): `null`;
- **registry problems:** a missing file, invalid JSON, or `{"format_version":1}` with no `keys` give `null` for everything;
- **invalid tier name** (`local2`): `null`;
- **always exit 0**, with nothing on stderr in any of the above;
- **`key_registry_has_key`:** exit 0 for exact and wildcard matches, 1 for unknown or malformed keys and for a missing registry.

**Registry parity** against the real, installed `shared/lib/config/keys.json` (no `KEY_REGISTRY_FILE`). It must equal `new KeyRegistry().allowsTier(key, tier)` from `shared/lib/config/KeyRegistry.js`, with `null` mapped to the string `null`, for:

- every entry, across `local`, `repo` and `global`;
  - for a wildcard entry, substitute each `<...>` segment with a concrete one such as `sample`;
- `git.agents` (non-leaf), `no.such.key` and `git.bad key`.

Batch several lookups into one bash invocation where practical, to keep the spec fast.

## Files to Change

- `core/spec/bin/sharedLibKeyRegistry_spec.js`: new.
