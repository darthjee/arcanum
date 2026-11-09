# Filter tiers in ConfigChain

Inject `registry` into `ConfigChain`'s constructor (default `new KeyRegistry()`). In `readWithSource`'s per-tier loop, skip a key for a tier when `this._registry.allowsTier(`${namespace}.${key}`, tier) === false`. Each tier is still fully resolved (all keys tried) before the next one. Keep the file-read optimization: read a tier's file only if at least one of the keys allows that tier.

In `readTiers`, compute `allowsTier` per tier and add `allowed` to the entry only when the result is a boolean. A disallowed tier's value is still reported (`set: true, value`). Update the JSDoc of `read`, `readWithSource`, `readTiers` and the class to say tiers come from `keys.json`.

Spec cases, with a fake registry where useful:

- a local-only key set in the repo and global tiers → `read` returns `undefined`, and `readTiers` reports both with `allowed: false`;
- a local-only key set in all three tiers → the local value wins;
- a repo-only key → the local and global values are ignored;
- a multi-key read where the keys allow different tiers (fake registry): within one tier, only the allowed keys are tried, and the tier order is kept;
- a wildcard key (`agents.node` under `git`);
- an unknown key outside strict mode → all three tiers are read and `allowed` is left out;
- the existing `null` / `""` / `false` / malformed-file / unresolvable-global cases still pass.

## Files to Change

- `shared/lib/config/ConfigChain.js`: constructor `registry` dep, filtering in `readWithSource`, `allowed` in `readTiers`, JSDoc.
- `shared/spec/config/ConfigChain_spec.js`: the new cases. Existing fixtures that set a key in a disallowed tier on purpose need updating. Check each failure: it should be a fixture that relied on reading every tier, not a real regression.
