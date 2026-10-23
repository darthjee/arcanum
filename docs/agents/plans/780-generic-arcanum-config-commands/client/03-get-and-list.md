# Read commands: get and list
Implement the read subcommands. Reads take no lock.

- `get <key>`: with no tier flag, resolve local → repo → global through `ConfigChain#readWithSource` and print the value and its source tier. With a tier flag, read only that tier's raw value. With `--all-tiers`, print every tier's value, shadowed ones included. An unset key exits `1`. A malformed tier gives a warning and counts as unset (exit `1` with an explicit tier).
- `list [tier]`: flattened dotted keys for every tier or only the given one, with registry descriptions for known keys (`KeyRegistry#lookup`).
- Both commands honour `--json` with the spec's shapes.

## Files to Change
- `cli/lib/commands/config/get.js` — the `get` command.
- `cli/lib/commands/config/list.js` — the `list` command.
- `cli/spec/lib/commands/config/get_spec.js`, `cli/spec/lib/commands/config/list_spec.js` (new) — specs using a temp-dir fake `CLAUDE_CONFIG_DIR` and repo. They cover resolution order, single tier, all tiers, unset key, malformed tiers, and the JSON shapes.
