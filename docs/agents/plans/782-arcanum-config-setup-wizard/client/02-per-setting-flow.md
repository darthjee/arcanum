# Per-setting flow
Implement the five-step per-setting dialogue for scalar items (enum, boolean and string), in `cli/lib/commands/config/setup/` or inside `setup.js`, whichever reads better.

1. **Show the setting:** `<key> — <description>`, then `current: <value> (<tier>)` or `current: (unset)`. The value comes from `readTiers` and `registryDefault`, as `config get` resolves it.
2. **Ask for the value:** `new value [<choices>, Enter keeps, - unsets]:`.
   - Enum choices come from `entry.values`. Booleans accept `y`/`n`, `on`/`off` and `true`/`false`, mapped to JSON booleans; build this on `BOOLEAN_TOKENS` plus `y`/`n`.
   - Strings are stored as typed (the shortcuts' `string` parser). Other types go through `values.js`'s `parseValue`.
   - An empty answer means "kept": record it and ask nothing more.
   - A value that fails validation (`validateSet`, which raises a `ValidationError`) prints the error to stderr and re-asks.
3. **Ask for the tier:** `tier [<allowed tiers>] (<default>):`, offering only `entry.tiers`.
   - The default is the shortcut's default tier: `SINGLE_VALUE[...].tier`, `DEFAULT_TIER` for `git.email`/`git.agents.*`, `local` for `next_step.auto.*` and `repo` for `ci`.
   - Factor that mapping into one exported `defaultTier(key)` helper next to the shortcuts, so the two can't drift.
   - Single-tier keys skip the question.
   - An invalid tier re-asks.
4. **Confirm:** `set <key> = <json> at <tier> (<file>)? [Y/n]` or `unset <key> at <tier> (<file>)? [Y/n]`.
   - Before it, print the shadowing note when a higher-precedence tier holds a value. Reuse `noteShadowing`'s lookup, refactored to return the overriding tier and value rather than only printing them.
   - `n` records "kept".
5. **Write** through the generic `set`/`unset` path (see the Notes in [client.md](../client.md)), forwarding `--lock-timeout`. Record `written` with tier, old and new on success, or `failed` with the reason on a non-validation `CliError`.

**Specs:** keep, set, unset with `-`, an invalid enum then a valid one, an invalid boolean token, a tier prompt with a non-default answer, single-tier skips, the shadowing note text, declining at `[Y/n]`, and booleans stored as JSON booleans.

## Files to Change
- `cli/lib/commands/config/setup.js` (or `cli/lib/commands/config/setup/*.js`) — the per-item dialogue.
- `cli/lib/commands/config/shortcuts/common.js` — split `noteShadowing` into a pure `findShadowing` plus the printer; export a `defaultTier(key)` helper (or place it in a new `shortcuts/defaultTier.js`).
- `cli/lib/commands/config/set.js`, `cli/lib/commands/config/unset.js` — only if factoring a reusable apply function out of `run`.
- `cli/spec/lib/commands/config/setup_spec.js` — the per-setting specs.
- `cli/spec/lib/commands/config/shortcuts/*_spec.js` — keep them green after the `common.js` refactor.
