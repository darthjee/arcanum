# Document update in the writer API
In the "Writer API" section of `docs/agents/architecture/shared-lib.md`, add an **`update({ newFile, legacyFile, namespace, key, mutate, timeoutMs })`** bullet after `unset`, in the same nested-bullet style. It should cover:
- the locked read-modify-write and its legacy seed;
- `mutate` receiving a copy;
- unchanged results skipping the write, using a deep comparison that ignores key order;
- the `{ changed, previous, value }` result;
- an `undefined` return being a `TypeError`;
- a throwing `mutate` writing nothing and releasing the lock;
- `NOT_AN_OBJECT`.

Mention that #781's `ignore-checks add/remove` is the first consumer. The existing `timeoutMs` bullet already says "every method", so it covers `update` with no change.

## Files to Change
- `docs/agents/architecture/shared-lib.md` — add the `update` bullet.
