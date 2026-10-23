# Add update and its specs
Add `update({ newFile, legacyFile, namespace, key, mutate, timeoutMs })` after `unset`, with a JSDoc block in the same style as `write` and `unset`. Also add `update` to the class header comment, next to `unset`.

The method:
- runs inside `this._locked(newFile, async () => { ... }, { timeoutMs })`;
- calls `_readBase(newFile)`;
- with a `namespace`, calls `_seedNamespace(config, namespace, legacyFile)`. A non-object section throws `NOT_AN_OBJECT`, as in `unset`. A missing or `null` section counts as an absent value. It then calls `_getPath(section, keyPath, namespace, newFile)`;
- without a `namespace`, calls `_getPath(config, keyPath, '', newFile)` and ignores `legacyFile`.

Once it has `previous`:
- It runs `const next = await mutate(structuredClone(previous))`. `structuredClone(undefined)` is `undefined`, and the `await` lets `mutate` be either sync or async.
- If `next === undefined`, it throws a `TypeError` ("update's mutate must return a value; use unset to delete"), so nothing is written.
- If `_deepEqual(next, previous)`, it records `changed = false` and returns `null`, so `_locked` skips the write.
- Otherwise it applies `_setNamespaced` (with a namespace) or `_setPath` (top-level), records `changed = true`, and returns `config`.

Carry `previous`, `next` and `changed` out of the closure in local `let`s, and resolve to `{ changed, previous, value: changed ? next : previous }`. If `mutate` throws, the error propagates through `_locked`'s `finally`, which releases the lock, and nothing is written.

Add a `describe('#update', ...)` block to the specs, using the real-filesystem fixtures the existing `#write` and `#unset` blocks use:
- **Absent key:** the key gets created, `previous` is `undefined`, and `changed` is `true`.
- **Existing value:** e.g. append to an array. Siblings and key order are kept, and the output is byte-identical to the equivalent `write`.
- **Dotted nested key:** missing intermediates get created.
- **Unchanged result**, with both a returned identical copy and a reordered object: no `writeFile` or `rename`, an absent file stays absent, and a legacy seed alone isn't persisted. The result is `changed: false`.
- **In-place mutation:** `mutate` pushes onto its argument and returns it, and `previous` keeps the old array.
- **`mutate` throws:** the same error is rejected, the bytes are unchanged, and the lock is released (`<file>.lock` is gone, and a following `write` succeeds).
- **`mutate` returns `undefined`:** a `TypeError`, with nothing written.
- **Async `mutate`.**
- **Legacy seed:** without `.<namespace>` in `newFile`, the legacy contents are visible to `mutate` and persisted on a change.
- **Top-level form** (no namespace), with `legacyFile` ignored.
- **`NOT_AN_OBJECT`** for a non-object namespace and for a non-object intermediate.
- **Concurrency:** two `update` calls under `Promise.all`, each appending a different item to the same array. The final array holds both items.

Also add an `update` entry to the existing `describe('timeoutMs')` `calls` table, so forwarding and `LockTimeoutError` (no write, no release) are covered the same way as the other methods.

## Files to Change
- `shared/lib/config/RepoConfigWriter.js` — add `update` and mention it in the class comment.
- `shared/spec/config/RepoConfigWriter_spec.js` — add the `#update` block and the `timeoutMs` table entry.
