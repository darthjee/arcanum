# Unit specs for config_chain_read's tier filter

Add `core/spec/bin/sharedLibConfigChain_spec.js`, using:

- a temp fixture repo with `.claude/state/arcanum-config.json` and `.claude/configuration/arcanum-repo-config.json`;
- a temp `CLAUDE_CONFIG_DIR` holding `arcanum-config.json`;
- a fixture registry through `KEY_REGISTRY_FILE`.

It sources `arcanum/_lib/config_chain.sh` and calls `config_chain_read`. Cases:

- **Disallowed tier skipped.** A key allowed only in `repo` and `global`, with values in all three tiers, resolves to the repo value.
- **Next allowed tier wins.** A key allowed only in `global`, with local and repo values, resolves to the global value.
- **Value only in a disallowed tier** resolves to empty output.
- **Multi-key, within one tier.** The first key is disallowed in `local` but set there, and the second key is allowed and set in `local`: the result is the second key's local value.
- **Unknown key** (not in the fixture registry): all three tiers are read, and local wins.
- **`null`** in an allowed tier falls through to the next allowed tier, and **`""`** stops the chain. Both behave as before.
- **Missing registry file:** behaves as the unfiltered chain (local wins).

## Files to Change

- `core/spec/bin/sharedLibConfigChain_spec.js`: new.
