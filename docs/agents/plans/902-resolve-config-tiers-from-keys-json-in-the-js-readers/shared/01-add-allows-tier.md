# Add KeyRegistry#allowsTier

Add `allowsTier(key, tier)` to `KeyRegistry`. It calls `this.lookup(key)`, returns `null` when there is no entry, and otherwise returns `entry.tiers.includes(tier)`. This is the single tier check that `ConfigChain` (step 02) and the CLI (client plan) share, so neither reimplements wildcard matching.

Spec cases:

- a literal key allowed and disallowed (`git.safe_branch` with `local` vs `repo`);
- a wildcard key (`git.agents.node`, `next_step.clear.discuss-issue`);
- an unknown key and a non-leaf (`git.agents`) → `null`;
- a malformed key → `null`.

## Files to Change

- `shared/lib/config/KeyRegistry.js`: add `allowsTier`, with JSDoc.
- `shared/spec/config/KeyRegistry_spec.js` : add the cases above.
