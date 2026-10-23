# Add the path reader and deep-equal helpers
Add two private static helpers next to `_setPath` and `_deletePath`, in the same JSDoc style.

- **`_getPath(target, keyPath, prefix, file)`** walks `keyPath` and returns the leaf value.
  - It returns `undefined` when the leaf is absent, or when a missing or `null` intermediate is in the way.
  - It throws `ConfigError` `NOT_AN_OBJECT` (the same message shape as `_setPath`) when an intermediate holds a non-object value.
  - Use `Object.hasOwn` for the leaf, so inherited keys never leak.
- **`_deepEqual(a, b)`** is a structural comparison of plain JSON values: primitives through `Object.is`, arrays by length and then element by element, and objects by the same own key set (order ignored) with recursion.
  - Document that it's only meant for parsed JSON, which has no cycles, Dates or Maps.
  - Document that key order is ignored. A reordered object counts as unchanged, so it isn't rewritten.

## Files to Change
- `shared/lib/config/RepoConfigWriter.js` — add `_getPath` and `_deepEqual`.
