# Mark ignored tiers in /arcanum-check-config

In `ArcanumCheckConfig#run`, for each `readTiers` entry:

- keep `file`, `set` and `value` as today;
- when `allowed === false`, also add `allowed: false` and `ignored: 'tier not allowed'`;
- when `allowed === true`, add nothing, so the output for allowed tiers and unknown keys stays byte-for-byte the same.

`final` comes from the first entry with `set && allowed !== false`. Update the class/method JSDoc.

Spec cases:

- `git.safe_branch` set in repo and global only → both marked, and `final` is `{ value: null, source: null }`;
- set locally and in the repo → local wins, repo marked;
- an allowed-only key → output unchanged;
- a non-leaf / unknown key (`git.agents`) → no markers.

Also update `core/spec/bin/arcanumCheckConfig_spec.js` if it covers a disallowed-tier fixture.

## Files to Change

- `core/lib/commands/arcanum-check-config/ArcanumCheckConfig.js`: marker and `final` rule.
- `core/spec/lib/commands/arcanum-check-config/ArcanumCheckConfig_spec.js`, `core/spec/bin/arcanumCheckConfig_spec.js`: the cases above.
