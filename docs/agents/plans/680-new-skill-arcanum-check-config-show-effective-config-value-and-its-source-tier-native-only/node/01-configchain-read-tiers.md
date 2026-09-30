# Per-tier read in ConfigChain
Add a public, origin-aware method to `core/lib/utils/config/ConfigChain.js`, e.g. `async readTiers(repoPath, namespace, key)`. It returns the three tiers in precedence order:

```js
[
  { tier: 'local',  file: '<abs path>', set: true,  value: <raw> },
  { tier: 'repo',   file: '<abs path>', set: false },
  { tier: 'global', file: '<abs path>' | null, set: false }
]
```

- Paths come from `_tierFiles()`, each non-null one made absolute with `path.resolve`.
- `set: true` + `value` when the tier's value is present and not `null` (`""` counts as set); otherwise `set: false` and no `value` property.
- A missing/unreadable/malformed file or a `null` global path is `set: false` (same fail-open rule as `read()`).
- `repoPath` falls back to the injected `repoContext.repoPath` when omitted, like `read()`.

Don't duplicate the resolution rule. Extract one private helper (e.g. `_tierValue(file, namespace, key)` returning `{ set, value }`) built on `_readJson()` + `_resolveKey()` + the present-and-non-null check, and have both `read()` and `readTiers()` use it. `read()`'s behavior and JSDoc contract stay unchanged, including its multi-key-per-tier ordering (a tier is fully resolved across all keys before advancing) and its `undefined` return. Watch that `read()` still parses each tier file at most once per call. JSDoc every new public method.

Extend `core/spec/lib/utils/config/ConfigChain_spec.js` for `readTiers`:
- all three tiers set: every tier reported, with values;
- only the global tier set;
- no tier set;
- a `null` value is `set: false`;
- `""` is `set: true`;
- missing file and malformed JSON are `set: false`;
- global `file` is `null` when neither `HOME` nor `CLAUDE_CONFIG_DIR` is set, and uses `CLAUDE_CONFIG_DIR` over `HOME` when both are set;
- nested key (`a.b.c`) and object/array values returned as subtrees;
- a relative `repoPath` yields absolute `file` paths.

All existing `read()` specs must still pass unchanged.

## Files to Change
- `core/lib/utils/config/ConfigChain.js` — add `readTiers` plus the shared per-tier helper; refactor `read()` onto it.
- `core/spec/lib/utils/config/ConfigChain_spec.js` — `readTiers` coverage.
