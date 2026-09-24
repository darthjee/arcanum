# Port label_config.sh to a shared LabelConfig service

Create `core/lib/services/LabelConfig.js`. It owns file I/O and is shared by two commands, so it belongs in `services/`. It ports every function of `init-claude/scripts/lib/label_config.sh` once:

- `DEFAULT_LABEL_CONFIG_PATH = '.claude/state/init-claude-config.json'` and a frozen `DEFAULT_LABEL_PAIRS`: the 22 pairs, in the shell's order.
- `validatePair(pair)` → `null`, or the exact stderr message (see plan.md).
- `readPairs(configPath)` → `[{name, color}]`, with the empty/malformed rules from plan.md. Split on the first `:` when reconstructing is not needed here; read `name` and `color` fields directly, like `jq -r '.name + ":" + .color'`.
- `write(configPath, pairs)`: `mkdir -p` the parent, write `<path>.tmp`, then rename. The content is `JSON.stringify({labels}, null, 2) + '\n'`.
- `ensureDefaults(configPath)`, `remove(configPath, names)` and `add(configPath, pairs)`: upsert by exact name, preserving position.

Validation returns messages rather than writing to stderr. The command layer owns stderr and exit codes, so the service stays import-clean (`services` → `utils` only).

## Files to Change
- `core/lib/services/LabelConfig.js` — new
